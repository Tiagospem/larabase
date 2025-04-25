/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/renderer/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "app-bg": "#1e1e1e",
        sidebar: "#252526",
        editor: "#1e1e1e",
        accent: "#FF2D20",
        primary: "#FF2D20"
      }
    }
  },
};