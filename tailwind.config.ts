import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'opt': {
          DEFAULT: '#A62183',
          light: '#f5e6f0',
          dark: '#8a1a6d',
        },
      },
    },
  },
  plugins: [],
};
export default config;
