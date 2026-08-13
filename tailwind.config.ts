import type { Config } from "tailwindcss";

/* MeraSafar design system — "the journey to your sarkari job".
   Royal indigo (trust, authority) + marigold (optimism, Indian warmth),
   slate neutrals, generous radii, soft elevation. */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc",
          400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca",
          800: "#3730a3", 900: "#312e81",
        },
        accent: {
          50: "#fffbeb", 100: "#fef3c7", 400: "#fbbf24", 500: "#f59e0b",
          600: "#d97706", 700: "#b45309",
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
