/** sessionStorage key: the first-load splash plays once per browser tab (D-144). */
export const SPLASH_KEY = "lunar-vista:splash";

/**
 * Runs before first paint (inline via `SplashGate` in the root layout): if this tab has already seen the splash, mark <html>
 * so CSS hides it at once, with no flash of the overlay.
 */
export const SPLASH_SEEN_SCRIPT = `try{if(sessionStorage.getItem(${JSON.stringify(SPLASH_KEY)}))document.documentElement.dataset.splash="seen"}catch(e){}`;
