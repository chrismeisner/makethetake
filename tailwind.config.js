// tailwind.config.js
const plugin = require('tailwindcss/plugin');

module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    // Example custom plugin that logs some info at build time
    plugin(function({ addBase, theme }) {
      console.log('Tailwind is compiling! Current theme colors:', theme('colors'));
    })
  ],
};
