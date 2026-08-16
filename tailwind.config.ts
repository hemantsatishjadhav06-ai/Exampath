import type { Config } from "tailwindcss";

/* MeraSafar design system — "the journey to your sarkari job".
   Royal indigo (trust, authority) + marigold (optimism, Indian warmth),
   slate neutrals, generous radii, soft elevation. */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Palette lives in CSS variables (globals.css) so the MeraSafar ⇄ Sarkari
      // mode toggle can retheme the whole site without a rebuild.
      colors: {
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)", 100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)", 300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)", 500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)", 700: "rgb(var(--brand-700) / <alpha-value>)",
          800: "rgb(var(--brand-800) / <alpha-value>)", 900: "rgb(var(--brand-900) / <alpha-value>)",
        },
        accent: {
          50: "rgb(var(--accent-50) / <alpha-value>)", 100: "rgb(var(--accent-100) / <alpha-value>)",
          400: "rgb(var(--accent-400) / <alpha-value>)", 500: "rgb(var(--accent-500) / <alpha-value>)",
          600: "rgb(var(--accent-600) / <alpha-value>)", 700: "rgb(var(--accent-700) / <alpha-value>)",
        },
      },
      borderRadius: { xl2: "1.15rem" },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.06), 0 8px 24px -16px rgba(15,23,42,.18)",
        lift: "0 18px 40px -18px rgba(49,46,129,.35)",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto",
          "Noto Sans", "Noto Sans Devanagari", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
