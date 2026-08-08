import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eefbfc",
          100: "#d4f3f6",
          200: "#ade6eb",
          300: "#78d2dc",
          400: "#3fb5c3",
          500: "#248f9f",
          600: "#1d7180",
          700: "#1c5b68",
          800: "#1b4a55",
          900: "#173e48",
        },
        ink: "#092f37",
        canvas: "#f7f6f1",
      },
      boxShadow: {
        card: "0 1px 2px rgb(8 47 55 / 0.06), 0 8px 24px rgb(8 47 55 / 0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
