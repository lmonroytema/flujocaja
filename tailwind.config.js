/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        ink: {
          950: "#060b12",
          900: "#0b1220",
          800: "#111b2d",
        },
        tide: {
          500: "#1d8fa8",
          400: "#37b0c6",
        },
        mint: {
          500: "#29d391",
          400: "#59ebb0",
        },
        amberx: {
          500: "#ffb14a",
          400: "#ffc970",
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "sans-serif"],
        display: ['"Fraunces"', "serif"],
      },
      boxShadow: {
        panel: "0 20px 80px rgba(3, 12, 27, 0.35)",
      },
    },
  },
  plugins: [],
};
