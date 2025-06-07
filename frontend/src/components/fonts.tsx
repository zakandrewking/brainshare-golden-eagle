import localFont from "next/font/local";

export const fontSans = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/ubuntu/files/ubuntu-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-sans",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const fontTitle = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/rajdhani/files/rajdhani-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const fontOrbitron = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/tilt-neon/files/tilt-neon-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-orbitron",
  fallback: ["monospace"],
});
