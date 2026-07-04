import type { Config } from "tailwindcss";
import preset from "../packages/ui/tailwind-preset";
export default {
  presets: [preset as any],
  content: [
    "./src/**/*.{ts,tsx}",
    "../packages/ui/src/**/*.{ts,tsx}",
  ],
} satisfies Config;
