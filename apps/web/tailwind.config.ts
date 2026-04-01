import type { Config } from "tailwindcss";
import sharedPreset from "@repo/config/tailwind";

const config: Config = {
  presets: [sharedPreset],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
