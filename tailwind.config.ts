import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        outfit: ["Outfit", "sans-serif"],
        inter: ["Inter", "sans-serif"],
      },
      colors: {
        // Brand tokens — Fast Lane Wash public palette
        "flw-bg":       "hsl(var(--flw-bg))",
        "flw-surface":  "hsl(var(--flw-surface))",
        "flw-card":     "hsl(var(--flw-card))",
        "flw-border":   "hsl(var(--flw-border))",
        "flw-gold":     "hsl(var(--flw-gold))",
        "flw-cyan":     "hsl(var(--flw-cyan))",
        "flw-orange":   "hsl(var(--flw-orange))",
        "flw-text":     "hsl(var(--flw-text))",
        "flw-muted":    "hsl(var(--flw-muted))",
        "flw-premium":  "hsl(var(--flw-premium))",
        "flw-nitido":   "hsl(var(--flw-nitido))",
      },
      backgroundImage: {
        "premium-card": "linear-gradient(135deg, #0f1b30 0%, #1a3a6b 50%, #0d2444 100%)",
        "nitido-card":  "linear-gradient(135deg, #0a1f1a 0%, #0d3d2f 50%, #082918 100%)",
        "hero-glow":    "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.15), transparent)",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%":   { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 12px 2px rgba(251,191,36,0.3)" },
          "50%":       { boxShadow: "0 0 28px 8px rgba(251,191,36,0.6)" },
        },
        "pulse-ring": {
          "0%":   { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":       { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-up":    "fade-up 0.5s ease-out forwards",
        "scale-in":   "scale-in 0.35s ease-out forwards",
        shimmer:      "shimmer 2s linear infinite",
        glow:         "glow 2s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.2s cubic-bezier(0.4,0,0.6,1) infinite",
        float:        "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
