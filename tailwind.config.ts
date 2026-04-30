import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FCFAF5",
          100: "#F7F4ED",
          200: "#EFEADC",
        },
        forest: {
          50: "#EEF3F0",
          100: "#D5E0D9",
          400: "#5C7E6E",
          500: "#3F6053",
          600: "#2F4F3E",
          700: "#243D30",
        },
        terracotta: {
          400: "#D89066",
          500: "#C97B49",
          600: "#A8623A",
        },
        ink: {
          900: "#1A1A1A",
          700: "#3D3D3D",
          500: "#6B6B6B",
          300: "#A8A8A8",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(45, 50, 40, 0.04), 0 4px 12px rgba(45, 50, 40, 0.06)",
        lifted: "0 4px 8px rgba(45, 50, 40, 0.06), 0 16px 32px rgba(45, 50, 40, 0.08)",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
