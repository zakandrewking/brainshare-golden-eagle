import {
  Rajdhani as FontTitle,
  Tilt_Neon,
  Ubuntu as FontSans,
} from "next/font/google";

export const fontSans = FontSans({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sans",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const fontTitle = FontTitle({
  subsets: ["latin"],
  weight: "700",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const fontOrbitron = Tilt_Neon({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-orbitron",
  fallback: ["monospace"],
});
