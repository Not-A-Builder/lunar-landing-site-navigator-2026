/** Shared by the root layout (server) and the theme hook (client). Light is the default theme. */
export const THEME_KEY = "lsn-theme";

/** Inline <head> script: applies the saved theme before first paint (no flash). */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
