import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import compress from 'astro-compress';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.osipov.uk/Bible',
  base: '/Bible/',

  integrations: [
    tailwind({
      applyBaseStyles: false, // We control base styles via tokens.css
    }),
    sitemap({
      filter: (page) =>
        !page.includes('/admin') &&
        !page.includes('/draft') &&
        !page.includes('/api'),
      changefreq: 'weekly',
      lastmod: new Date(),
    }),
    compress({
      CSS: true,
      HTML: {
        removeAttributeQuotes: false, // Keep quotes for safety
        removeComments: true,
        minifyJS: true,
      },
      Image: false, // Astro handles images
      JavaScript: true,
      SVG: true,
    }),
  ],

  output: 'static',

  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
    // Default formats for Astro <Image> component
    remotePatterns: [{ protocol: 'https' }],
  },

  vite: {
    build: {
      // Inline small assets to reduce HTTP requests
      assetsInlineLimit: 4096,
    },
  },

  // Security headers via netlify.toml for static sites
  // Content security policy set there

  markdown: {
    shikiConfig: {
      theme: 'github-light',
      wrap: true,
    },
  },
});
