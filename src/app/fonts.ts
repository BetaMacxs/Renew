import {
  Bodoni_Moda,
  Bricolage_Grotesque,
  Geist_Mono,
  IBM_Plex_Sans_Arabic,
  Inter,
  Plus_Jakarta_Sans,
} from "next/font/google";

/**
 * Self-hosted at build time by next/font — no request to Google from the
 * shopper's browser. Inter (body) and Plus Jakarta Sans (display) are preloaded
 * for Detail Corner; alternate editorial pairings load only when selected.
 */

export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni",
  display: "swap",
  preload: false,
});

export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  preload: false,
});

export const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
  preload: false,
});

export const fontVariables = [inter, plusJakarta, bodoni, bricolage, geistMono, plexArabic]
  .map((font) => font.variable)
  .join(" ");
