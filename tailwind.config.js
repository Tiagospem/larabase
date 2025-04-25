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
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        dark: {
          primary: "#FF2D20",
          secondary: "#30363d",
          accent: "#FF2D20",
          neutral: "#252526",
          "base-100": "#1e1e1e",
          "base-200": "#2d2d30",
          "base-300": "#333333"
        }
      }
    ]
  }
};