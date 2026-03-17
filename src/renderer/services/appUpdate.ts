import { getUpdateCheckUrl, getFallbackDownloadUrl } from './endpoints';

export const UPDATE_POLL_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const UPDATE_HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000;

export type ChangeLogEntry = { title: string; content: string[] };

export interface AppUpdateDownloadProgress {
  received: number;
  total: number | undefined;
  percent: number | undefined;
  speed: number | undefined;
}

export interface AppUpdateInfo {
  latestVersion: string;
  date: string;
  changeLog: { zh: ChangeLogEntry; en: ChangeLogEntry };
  url: string;
}

// GitHub Releases API response types
interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubReleaseResponse {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  assets: GitHubReleaseAsset[];
}

const toVersionParts = (version: string): number[] => (
  version
    .split('.')
    .map((part) => {
      const match = part.trim().match(/^\d+/);
      return match ? Number.parseInt(match[0], 10) : 0;
    })
);

const compareVersions = (a: string, b: string): number => {
  const aParts = toVersionParts(a);
  const bParts = toVersionParts(b);
  const maxLength = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLength; i += 1) {
    const left = aParts[i] ?? 0;
    const right = bParts[i] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }

  return 0;
};

const isNewerVersion = (latestVersion: string, currentVersion: string): boolean => (
  compareVersions(latestVersion, currentVersion) > 0
);

const getPlatformAssetUrl = (assets: GitHubReleaseAsset[]): string => {
  const { platform, arch } = window.electron;

  if (platform === 'darwin') {
    const suffix = arch === 'arm64' ? 'arm64.dmg' : 'x64.dmg';
    const asset = assets.find((a) => a.name.endsWith(suffix) && !a.name.endsWith('.blockmap'));
    // Fallback: any .dmg that isn't a blockmap
    const fallbackAsset = asset || assets.find((a) => a.name.endsWith('.dmg') && !a.name.endsWith('.blockmap'));
    return fallbackAsset?.browser_download_url || getFallbackDownloadUrl();
  }

  if (platform === 'win32') {
    const asset = assets.find((a) => a.name.endsWith('.exe'));
    return asset?.browser_download_url || getFallbackDownloadUrl();
  }

  return getFallbackDownloadUrl();
};

const parseReleaseBody = (body: string): ChangeLogEntry => {
  const lines = body.split('\n').filter((l) => l.trim());
  const title = lines[0] || '';
  const content = lines.slice(1).map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
  return { title, content };
};

export const checkForAppUpdate = async (currentVersion: string): Promise<AppUpdateInfo | null> => {
  const response = await window.electron.api.fetch({
    url: getUpdateCheckUrl(),
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'OpenJobsAI-Updater',
    },
  });

  if (!response.ok || typeof response.data !== 'object' || response.data === null) {
    return null;
  }

  const release = response.data as GitHubReleaseResponse;
  const latestVersion = release.tag_name?.replace(/^v/, '').trim();

  if (!latestVersion || !isNewerVersion(latestVersion, currentVersion)) {
    return null;
  }

  const changelog = parseReleaseBody(release.body || '');

  return {
    latestVersion,
    date: release.published_at?.split('T')[0] || '',
    changeLog: {
      zh: changelog,
      en: changelog,
    },
    url: getPlatformAssetUrl(release.assets || []),
  };
};
