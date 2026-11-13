export const THEME_KEY = 'pulse-theme';
export type Theme = 'light' | 'dark' | 'system';

// Runs in the browser. "system" means: follow the phone/computer setting (no forced theme).
export function applyTheme(theme: string) {
  const root = document.documentElement;
  try {
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_KEY, theme);
    } else {
      root.removeAttribute('data-theme');
      localStorage.removeItem(THEME_KEY);
    }
  } catch {
    /* storage unavailable: the theme still applies for this visit */
  }
}

// Inlined into <head> so the saved theme is applied before the page paints (no flash).
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;
