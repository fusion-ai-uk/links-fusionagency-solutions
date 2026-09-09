import type { SVGProps } from "react";

/**
 * A small, consistent icon set drawn as 24-unit strokes. Kept in-repo so the
 * dashboard has no external asset dependency and every icon shares one weight.
 */
const PATHS: Record<string, string> = {
  // Signal classes
  check: "M5 12.5l4.5 4.5L19 7.5",
  echo: "M4 12a8 8 0 0 1 8-8M12 20a8 8 0 0 0 8-8M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0M2 12h2M20 12h2",
  repeat: "M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3",
  user: "M20 21a8 8 0 1 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  bot: "M12 3v4M8 7h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3M9 13h.01M15 13h.01M3 12h2M19 12h2",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2",
  flask: "M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3M7 15h10",
  // Navigation and controls
  mail: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1M3 7l9 6 9-6",
  building: "M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M8 7h2M8 11h2M8 15h2M12 7h2M12 11h2M12 15h2M3 21h18",
  layers: "M12 3l9 5-9 5-9-5 9-5M3 13l9 5 9-5M3 17l9 5 9-5",
  filter: "M3 5h18l-7 8v6l-4 2v-8L3 5",
  chevron: "M6 9l6 6 6-6",
  close: "M6 6l12 12M18 6L6 18",
  download: "M12 3v12M6 11l6 6 6-6M4 21h16",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3",
  reset: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 16v-4M12 8h.01",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  guide: "M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2M4 19.5A2 2 0 0 0 6 21h13",
  warning: "M12 3l10 18H2L12 3M12 10v4M12 18h.01",
  external: "M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5",
};

export type IconName = keyof typeof PATHS;

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName | string;
  size?: number;
  /** Decorative by default; pass a label to make it meaningful. */
  label?: string;
};

export default function Icon({ name, size = 14, label, ...rest }: IconProps) {
  const d = PATHS[name] ?? PATHS.info;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
      style={{ flex: "0 0 auto", verticalAlign: "-0.15em" }}
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
