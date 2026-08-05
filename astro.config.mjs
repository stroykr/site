import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import react from "@astrojs/react";

import svgr from 'vite-plugin-svgr';

export default defineConfig({
  vite: {
    plugins: [tailwindcss(), svgr()]
  },

  integrations: [react()]
});