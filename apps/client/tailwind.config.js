/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
      },
      colors: {
        pokedex: {
          red: "#dc2626",
          darkred: "#991b1b",
          lightred: "#ef4444",
          shadow: "#7f1d1d",
          highlight: "#f87171",
        },
        bezel: {
          dark: "#1e293b",
          black: "#0f172a",
          border: "#334155",
        },
        lcd: {
          classic: {
            bg: "#8bac0f",
            bgDark: "#9bbc0f",
            fg: "#0f380f",
            dim: "#306230",
          },
          cyber: {
            bg: "#cbd5e1",
            bgDark: "#94a3b8",
            fg: "#0f172a",
            dim: "#475569",
          },
        },
        pokeType: {
          normal: "#A8A878",
          fire: "#F08030",
          water: "#6890F0",
          grass: "#78C850",
          electric: "#F8D030",
          ice: "#98D8D8",
          fighting: "#C03028",
          poison: "#A040A0",
          ground: "#E0C068",
          flying: "#A890F0",
          psychic: "#F85888",
          bug: "#A8B820",
          rock: "#B8A038",
          ghost: "#705898",
          dragon: "#7038F8",
        },
      },
    },
  },
  plugins: [],
};
