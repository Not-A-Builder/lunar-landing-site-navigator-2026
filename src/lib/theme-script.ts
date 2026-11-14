/** Shared by the root layout (server) and the theme hook (client). */
export const THEME_KEY = "lsn-theme";

/**
 * Inline <head> script, runs before first paint (no flash). A saved choice wins; otherwise the theme
 * follows the device's light/dark setting, including when it changes while the page is open.
 */
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,K="${THEME_KEY}",t=null;try{t=localStorage.getItem(K)}catch(e){}if(t!=="dark"&&t!=="light"){var m=window.matchMedia("(prefers-color-scheme: dark)");t=m.matches?"dark":"light";m.addEventListener&&m.addEventListener("change",function(e){var s=null;try{s=localStorage.getItem(K)}catch(x){}if(s!=="dark"&&s!=="light")d.setAttribute("data-theme",e.matches?"dark":"light")})}d.setAttribute("data-theme",t)}catch(e){}})()`;
