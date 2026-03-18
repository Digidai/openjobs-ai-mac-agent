/**
 * 集中管理所有业务 API 端点。
 * 后续新增的业务接口也应在此文件中配置。
 */

// 自动更新 — GitHub Releases API (public repo)
export const getUpdateCheckUrl = () =>
  'https://api.github.com/repos/Digidai/openjobs-ai-releases/releases/latest';

export const getFallbackDownloadUrl = () =>
  'https://github.com/Digidai/openjobs-ai-releases/releases';

// Skill 商店暂未公开新的 OpenJobs 端点，调用方需按 null 优雅降级。
export const getSkillStoreUrl = (): string | null => null;
