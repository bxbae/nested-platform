import type { Config } from "tailwindcss";

// Tailwind wired to the existing CSS-variable design system so utilities and
// the legacy token classes coexist. Dark mode via the .dark class already set.
export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "var(--primary)", press: "var(--primary-press)", soft: "var(--primary-soft)" },
        secondary: { DEFAULT: "var(--secondary)", soft: "var(--secondary-soft)" },
        bg: { DEFAULT: "var(--bg)", 2: "var(--bg-2)" },
        surface: "var(--surface)",
        fg: { DEFAULT: "var(--text)", 2: "var(--text-2)" },
        line: "var(--border)",
        success: "var(--success)",
        warning: "var(--warning)",
      },
      borderRadius: {
        sm: "var(--r-sm)", md: "var(--r-md)", lg: "var(--r-lg)", xl: "var(--r-xl)", pill: "var(--r-pill)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)", md: "var(--shadow-md)", lg: "var(--shadow-lg)",
      },
      fontFamily: {
        body: "var(--font-body)", mono: "var(--font-mono)",
      },
    },
  },
  plugins: [],
} satisfies Config;
