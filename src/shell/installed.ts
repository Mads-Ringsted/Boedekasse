export interface DisplayEnv {
  /** `matchMedia('(display-mode: standalone)').matches` */
  displayModeStandalone: boolean;
  /** iOS's non-standard `navigator.standalone` */
  navigatorStandalone: boolean;
  /** `import.meta.env.DEV` */
  dev: boolean;
  /** `location.search` */
  search: string;
}

/**
 * True when the app runs from the home screen. In a browser tab the app
 * shows only the install guide. During local development the app shows
 * in a desktop browser; add `?installer` to see the guide.
 */
export function isInstalled(env: DisplayEnv): boolean {
  if (env.displayModeStandalone || env.navigatorStandalone) return true;
  return env.dev && !new URLSearchParams(env.search).has('installer');
}

export function readDisplayEnv(): DisplayEnv {
  return {
    displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
    navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
    dev: import.meta.env.DEV,
    search: window.location.search,
  };
}
