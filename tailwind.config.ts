import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Nunito", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#FF8B00",
          dark: "#E07A00",
          light: "#FFA733",
        },
        accent: {
          DEFAULT: "#4F46E5",
          dark: "#3730A3",
          light: "#818CF8",
        },
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
