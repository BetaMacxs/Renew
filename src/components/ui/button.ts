/**
 * Button styles as class strings, so links, buttons and form submits all
 * look identical without a wrapper component per element type.
 */

export type ButtonVariant = "primary" | "dark" | "outline" | "ghost" | "whatsapp" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export function buttonClass(
  options: { variant?: ButtonVariant; size?: ButtonSize; full?: boolean; className?: string } = {},
): string {
  const { variant = "primary", size = "md", full = false, className = "" } = options;
  return ["dc-btn", `dc-btn--${variant}`, `dc-btn--${size}`, full ? "dc-btn--full" : "", className]
    .filter(Boolean)
    .join(" ");
}
