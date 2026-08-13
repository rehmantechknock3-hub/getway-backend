import type { Config } from "tailwindcss";
import sharedPreset from "@repo/config/tailwind";

const config: Config = {
  presets: [sharedPreset],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          night: "#070B14",
          "night-elevated": "#121826",
          "night-border": "#2A3348",
          blue: "#2D5BFF",
          "blue-dark": "#2547E6",
          cyan: "#38BDF8",
          violet: "#8B5CF6",
          magenta: "#A855F7",
          mist: "#F4F6FF",
        },
      },
      backgroundImage: {
        "waynow-aurora":
          "radial-gradient(ellipse 80% 60% at 10% -10%, rgba(139,92,246,0.22), transparent 50%), radial-gradient(ellipse 70% 50% at 95% 0%, rgba(45,91,255,0.18), transparent 45%), radial-gradient(ellipse 50% 40% at 80% 100%, rgba(56,189,248,0.12), transparent 50%), linear-gradient(180deg, #F4F6FF 0%, #EEF2FF 45%, #F8FAFC 100%)",
        "waynow-mark":
          "linear-gradient(135deg, #8B5CF6 0%, #2D5BFF 55%, #38BDF8 100%)",
        "waynow-card":
          "linear-gradient(160deg, rgba(255,255,255,0.95) 0%, rgba(244,246,255,0.9) 100%)",
        "waynow-sidebar":
          "linear-gradient(180deg, #0B1020 0%, #070B14 45%, #0A1224 100%)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139,92,246,0.12), 0 12px 40px -16px rgba(45,91,255,0.45)",
        "glow-sm": "0 8px 24px -12px rgba(45,91,255,0.35)",
        panel: "0 1px 0 rgba(255,255,255,0.7) inset, 0 18px 40px -28px rgba(15,23,42,0.35)",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(0.85)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "fade-up": "fade-up 0.45s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
