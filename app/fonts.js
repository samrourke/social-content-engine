/*
 * Fonts are self-hosted by next/font — no layout shift, no Google request
 * from the browser. Each font exposes a CSS variable, wired up to
 * --font-sans / --font-serif in globals.css.
 *
 * Swap these per project. For licensed fonts, drop the .woff2 in
 * /public/fonts and use localFont instead:
 *
 *   import localFont from "next/font/local";
 *
 *   export const display = localFont({
 *     src: "../../public/fonts/MyFont-Bold.woff2",
 *     variable: "--font-display",
 *     display: "swap",
 *     weight: "700",
 *   });
 */
import { Work_Sans, Caprasimo } from "next/font/google";

export const sans = Work_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

export const display = Caprasimo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: "400",
});
