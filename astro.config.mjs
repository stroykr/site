import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import react from "@astrojs/react";

import svgr from 'vite-plugin-svgr';

export default defineConfig({
  site: 'https://stroykr.github.io',
  base: '/site/',

  vite: {
    plugins: [tailwindcss(), svgr()]
  },

  integrations: [react()]
});
