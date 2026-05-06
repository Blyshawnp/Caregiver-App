import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#F7FCFC",
          100: "#EEF8F8",
          200: "#D7ECEC",
        },
        forest: {
          50: "#E8F5F7",
          100: "#C9E7EC",
          400: "#287F9A",
          500: "#0D6587",
          600: "#004B73",
          700: "#003856",
        },
        terracotta: {
          400: "#6AD0CE",
          500: "#28AEB3",
          600: "#148B98",
        },
        ink: {
          900: "#10202A",
          700: "#304854",
          500: "#637A84",
          300: "#A7BBC1",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0, 64, 112, 0.04), 0 4px 12px rgba(0, 64, 112, 0.06)",
        lifted: "0 4px 8px rgba(0, 64, 112, 0.06), 0 16px 32px rgba(0, 64, 112, 0.08)",
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
