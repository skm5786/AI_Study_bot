/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f1115",
        panel: "#171a21",
        panelSoft: "#1d212b",
        border: "#2a3140",
        text: "#e8ecf1",
        muted: "#9aa4b2",
        accent: "#10a37f",
        accentHover: "#0e8f70",
        danger: "#ef4444"
      },
      boxShadow: {
        glow: "0 0 0 1px #2a3140, 0 10px 30px rgba(0, 0, 0, 0.35)"
      },
      borderRadius: {
        xl2: "1rem"
      }
    }
  },
  plugins: []
};
