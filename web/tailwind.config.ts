import type { Config } from "tailwindcss";

// Tailwind is available in the toolchain; the UI is driven by the ported
// design system in app/globals.css, so utilities are additive/optional.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#1d4ed8",
        saffron: "#f97316",
      },
    },
  },
  plugins: [],
};
export default config;
