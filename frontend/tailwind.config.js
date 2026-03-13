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
        brand: "#00C2FF",
        "brand-dim": "#0099CC",
        "cs-bg": "#080C10",
        "cs-card": "#0D1117",
        "cs-border": "rgba(255,255,255,0.06)",
        "cs-success": "#00E5A0",
        "cs-warning": "#F59E0B",
        "cs-danger": "#FF4757",
      },
    },
  },
  plugins: [],
};
