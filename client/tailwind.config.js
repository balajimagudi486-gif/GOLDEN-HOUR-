/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Medical theme brand palette
        med: {
          DEFAULT: "#0E9BB0",
          dark: "#0A7183",
          deep: "#085663",
          light: "#E6F7F9",
          soft: "#CFF0F4",
        },
        app: {
          bg: "#EEF4F7",
          card: "#FFFFFF",
          line: "#E2E8F0",
        },
        sos: {
          DEFAULT: "#DC2626",
          dark: "#991B1B",
          glow: "#FCA5A5",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
        cardHover: "0 6px 16px rgba(15, 23, 42, 0.08)",
      },
      animation: {
        "pulse-sos": "pulse-sos 1.2s ease-in-out infinite",
        flash: "flash 0.45s ease-in-out infinite alternate",
      },
      keyframes: {
        "pulse-sos": {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(220,38,38,0.7)" },
          "50%": { transform: "scale(1.03)", boxShadow: "0 0 0 22px rgba(220,38,38,0)" },
        },
        flash: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0.55" },
        },
      },
    },
  },
  plugins: [],
};