import type { Config } from "tailwindcss";

const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./src/components/**/*.{ts,tsx}", "./src/app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: c("bg"),
        panel: c("panel"),
        "panel-hover": c("panel-hover"),
        line: c("line"),
        fg: c("fg"),
        muted: c("muted"),
        accent: c("accent"),
        up: c("up"),
        down: c("down"),
        warn: c("warn"),
      },
    },
  },
  plugins: [],
} satisfies Config;
