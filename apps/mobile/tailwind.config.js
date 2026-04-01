const sharedPreset = require("@repo/config/tailwind");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [sharedPreset, require("nativewind/preset")],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Ember & Stone — iOS-native service marketplace palette
        primary: {
          50:  "#FFF5EE",
          100: "#FFE6D5",
          200: "#FFC9A8",
          300: "#FFA472",
          400: "#FF7A3C",
          500: "#FF6B35",
          600: "#E8521A",
          700: "#C23D0F",
          800: "#9A2D09",
          900: "#7A2208",
          950: "#420C01",
        },
        ink: {
          DEFAULT: "#1C1917",
          soft:    "#44403C",
          muted:   "#78716C",
          subtle:  "#A8A29E",
          faint:   "#E8E6E1",
        },
        canvas: {
          DEFAULT: "#FAFAF8",
          raised:  "#FFFFFF",
          sunken:  "#F5F4F1",
        },
      },
    },
  },
  plugins: [],
};
