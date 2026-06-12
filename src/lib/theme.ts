export type Theme = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'unified-inbox-theme';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage unavailable (private mode, etc.)
  }
  return 'system';
}

function resolve(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Apply a theme to the document (resolves 'system' via matchMedia). */
export function applyTheme(theme: Theme): void {
  const resolved = resolve(theme);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.style.colorScheme = resolved;
}

/** Persist + apply. */
export function setTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Best-effort persistence; still apply for this session.
  }
  applyTheme(theme);
}

/** Watch OS color-scheme changes. Returns an unsubscribe function. */
export function watchSystemTheme(cb: (prefersDark: boolean) => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => cb(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
