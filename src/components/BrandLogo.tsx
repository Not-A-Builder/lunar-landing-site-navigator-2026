"use client";

import Image from "next/image";
import { LOGO, SITE_FULL_NAME, SITE_TITLE } from "@/lib/config";
import { type Theme, useTheme } from "@/lib/theme";

/**
 * The Lunar VISTA wordmark (D-143), sized by height. Follows the current theme unless `theme` forces one
 * (the splash is always dark). Only the active variant is requested: each file is ~400 KB.
 * Without `height`, the size comes from `className` (e.g. a fluid width with auto height).
 */
export function BrandLogo({ height, theme, preload, className }: { height?: number; theme?: Theme; preload?: boolean; className?: string }) {
  const current = useTheme();
  const logo = LOGO[theme ?? current];
  return (
    <Image
      src={logo.src}
      width={logo.width}
      height={logo.height}
      alt={`${SITE_TITLE}: ${SITE_FULL_NAME}`}
      unoptimized
      {...(preload ? { preload: true } : { loading: "eager" as const })}
      draggable={false}
      style={height ? { height, width: (height * logo.width) / logo.height } : undefined}
      className={className}
    />
  );
}
