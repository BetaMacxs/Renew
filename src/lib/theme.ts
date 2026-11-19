import type { StoreSettings } from "@/lib/domain/settings";

/**
 * Turns the theme an owner picks in the dashboard into CSS custom properties.
 * Every colour and font in the storefront reads from these, so a change in
 * Settings → Storefront restyles the whole shop on the next page view.
 */

type Theme = StoreSettings["theme"];

function channels(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

function toHex(r: number, g: number, b: number): string {
  const part = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${part(r)}${part(g)}${part(b)}`;
}

function mixHex(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  return toHex(ar + (br - ar) * amount, ag + (bg - ag) * amount, ab + (bb - ab) * amount);
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const OBSIDIAN_BG = "#0C0D0E";
const OBSIDIAN_SURFACE = "#141618";
const WHITE = "#FFFFFF";

/** Text colour for a surface filled with `accent`: whichever reads better. */
export function readableOn(accent: string): string {
  return contrastRatio(accent, WHITE) >= contrastRatio(accent, OBSIDIAN_BG) ? WHITE : OBSIDIAN_BG;
}

/**
 * The accent as a text colour on dark Obsidian surfaces (`#141618`).
 * Dark brand hues like Crimson or Petrol stay in their hue family while
 * lifting luminance enough to maintain >= 4.6:1 WCAG AA readability.
 */
export function accentText(accent: string): string {
  if (contrastRatio(accent, OBSIDIAN_SURFACE) >= 4.5) return accent;
  for (let step = 0.1; step <= 0.9; step += 0.06) {
    const candidate = mixHex(accent, WHITE, step);
    if (contrastRatio(candidate, OBSIDIAN_SURFACE) >= 4.6) return candidate;
  }
  return WHITE;
}

export function accentHover(accent: string): string {
  if (accent.toUpperCase() === "#C41E3A") return "#DC2626";
  return mixHex(accent, WHITE, 0.12);
}

const FONT_STACKS: Record<
  Theme["fontPairing"],
  { display: string; transform: string; stretch: string; tracking: string; weight: string }
> = {
  signage: {
    display: "var(--font-jakarta)",
    transform: "none",
    stretch: "100%",
    tracking: "-0.025em",
    weight: "700",
  },
  editorial: {
    display: "var(--font-bodoni)",
    transform: "none",
    stretch: "100%",
    tracking: "-0.015em",
    weight: "500",
  },
  friendly: {
    display: "var(--font-bricolage)",
    transform: "none",
    stretch: "100%",
    tracking: "-0.02em",
    weight: "700",
  },
};

const RADII: Record<Theme["corners"], { card: string; control: string; pill: string }> = {
  sharp: { card: "0px", control: "0px", pill: "0px" },
  soft: { card: "12px", control: "8px", pill: "999px" },
  round: { card: "20px", control: "14px", pill: "999px" },
};

export const ACCENT_PRESETS = [
  { name: "Crimson", value: "#C41E3A" },
  { name: "Gold", value: "#D4A853" },
  { name: "Petrol", value: "#0F4C5C" },
  { name: "Ink", value: "#161614" },
  { name: "Pine", value: "#1D5B3A" },
  { name: "Cobalt", value: "#2440C8" },
  { name: "Plum", value: "#6A2C5E" },
  { name: "Tomato", value: "#D2452B" },
  { name: "Saffron", value: "#F1B21B" },
  { name: "Clay", value: "#A65B3A" },
] as const;

export function themeStyle(theme: Theme): Record<string, string> {
  const fonts = FONT_STACKS[theme.fontPairing];
  const radii = RADII[theme.corners];
  return {
    "--accent": theme.accent,
    "--accent-hover": accentHover(theme.accent),
    "--accent-ink": readableOn(theme.accent),
    "--accent-text": accentText(theme.accent),
    "--font-display": `${fonts.display}, var(--font-plex-arabic), ui-sans-serif, system-ui, sans-serif`,
    "--display-transform": fonts.transform,
    "--display-stretch": fonts.stretch,
    "--display-tracking": fonts.tracking,
    "--display-weight": fonts.weight,
    "--radius-card": radii.card,
    "--radius-control": radii.control,
    "--radius-pill": radii.pill,
  };
}
