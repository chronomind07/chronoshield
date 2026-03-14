/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        syne: ["var(--font-syne)", "system-ui", "sans-serif"],
        mono: ["var(--font-dm-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        brand:       "#00C2FF",
        "brand2":    "#0077FF",
        "cs-bg":     "#080C10",
        "cs-bg2":    "#0D1218",
        "cs-bg3":    "#121A22",
        "cs-border": "rgba(255,255,255,0.06)",
        "cs-muted":  "#5A6B7A",
        "cs-text":   "#E8EDF2",
        "cs-green":  "#00E5A0",
        "cs-yellow": "#FFB340",
        "cs-red":    "#FF4D6A",
      },
      gridTemplateColumns: {
        "score": "280px 1fr",
        "bottom": "1fr 340px",
      },
    },
  },
  plugins: [],
};
