"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { setTheme, useTheme } from "@/lib/theme";

/** Switches between the light (default) and dark themes. */
export function ThemeToggle() {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-line text-muted transition-colors hover:border-muted hover:text-fg"
    >
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
