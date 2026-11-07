/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    /* Tailwind v4: satu plugin, tanpa tailwind.config.js. Token dan lapisan
       utilitas dideklarasikan di app/globals.css (@import + @theme). */
    "@tailwindcss/postcss": {}
  }
};

export default config;
