const DASHBOARD_HOST = 'review-dashboard.teczeed.com';
const PROFILE_HOST = 'review-profile.teczeed.com';

export type UiHostMode = 'local' | 'dashboard' | 'profile';

export function getUiHostMode(hostname = window.location.hostname): UiHostMode {
  if (hostname === DASHBOARD_HOST) {
    return 'dashboard';
  }

  if (hostname === PROFILE_HOST) {
    return 'profile';
  }

  return 'local';
}

export function getDashboardHomePath(mode: UiHostMode): string {
  return mode === 'dashboard' ? '/dashboard' : '/login';
}

export function getPublicProfilePath(slug: string): string {
  return `/profile/${slug}`;
}

export function getPublicProfileHref(slug: string, hostname = window.location.hostname): string {
  const path = getPublicProfilePath(slug);
  const mode = getUiHostMode(hostname);

  if (mode === 'dashboard') {
    return `https://${PROFILE_HOST}${path}`;
  }

  return path;
}
