import React from 'react';
import { i18nService } from '../../services/i18n';

interface AppUpdateBadgeProps {
  latestVersion: string;
  onClick: () => void;
  downloaded?: boolean;
}

const AppUpdateBadge: React.FC<AppUpdateBadgeProps> = ({ latestVersion, onClick, downloaded }) => {
  const label = downloaded
    ? i18nService.t('updateReadyToInstall')
    : i18nService.t('updateAvailablePill');

  const colorClasses = downloaded
    ? 'border-blue-500/30 bg-blue-500/12 text-blue-600 hover:bg-blue-500/18 dark:text-blue-400'
    : 'border-emerald-500/30 bg-emerald-500/12 text-emerald-600 hover:bg-emerald-500/18 dark:text-emerald-400';

  const dotColor = downloaded
    ? 'bg-blue-500 dark:bg-blue-400'
    : 'bg-emerald-500 dark:bg-emerald-400';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`non-draggable inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${colorClasses}`}
      title={`${label} ${latestVersion}`}
      aria-label={`${label} ${latestVersion}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      <span>{label}</span>
    </button>
  );
};

export default AppUpdateBadge;
