/** @type {import('tailwindcss').Config} */
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
  content: ['./src/index.html', './src/**/*.{js,ts,jsx,tsx}'],
  plugins: [tailwindcssAnimate]
};
