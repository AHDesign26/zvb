import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://zvb.bg',
  integrations: [svelte()],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    format: 'file',
  },
  trailingSlash: 'never',
});
