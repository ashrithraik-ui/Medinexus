/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#050b14",
          900: "#07111f",
          800: "#0b1a2e",
          700: "#10233d",
          600: "#163056",
        },
        ocean: {
          950: "#040c1a",
          900: "#06152b",
          800: "#0a1f3d",
          700: "#0f2d57",
        },
        accent: {
          blue: "#38bdf8",
          teal: "#2ee6c6",
          cyan: "#22d3ee",
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "Manrope", "sans-serif"],
        display: ["Syne", '"Plus Jakarta Sans"', "sans-serif"],
        serif: ['"Playfair Display"', '"Instrument Serif"', "Georgia", "serif"],
      },
      boxShadow: {
        glow: "0 0 35px rgba(46, 230, 198, 0.2)",
        "glow-blue": "0 0 45px rgba(56, 189, 248, 0.25)",
        "glow-card": "0 20px 60px rgba(0, 0, 0, 0.65), 0 0 40px rgba(56, 189, 248, 0.12)",
        glass: "0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
      },
    },
  },
  plugins: [],
};
