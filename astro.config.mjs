// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages: https://seory0.github.io/DADES
export default defineConfig({
  site: 'https://seory0.github.io',
  base: '/DADES',
  integrations: [sitemap()],
});
