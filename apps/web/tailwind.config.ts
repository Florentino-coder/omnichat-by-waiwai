import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./apps/web/app/**/*.{ts,tsx}", "./apps/web/lib/**/*.{ts,tsx}", "./packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        border: "var(--card-border)",
        secondary: "var(--secondary)",
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        "primary-soft": "var(--primary-soft)",
        success: "var(--success)",
        "success-soft": "var(--success-soft)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        muted: {
          foreground: "var(--muted-foreground)",
          light: "var(--muted-foreground-light)"
        }
      },
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"]
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px"
      }
    }
  },
  plugins: []
};

export default config;
