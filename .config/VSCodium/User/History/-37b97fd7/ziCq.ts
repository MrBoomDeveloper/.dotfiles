// @ts-check
import { defineConfig } from 'astro/config';

import compressor from "astro-compressor";

// https://astro.build/config
export default defineConfig({
  site: "https://mrboomdev.ru",
  base: "/",

  i18n: {
      locales: ["en", "ru"],
      defaultLocale: "en",

      routing: {
          prefixDefaultLocale: true
      }
	},

	integrations: [
		compressor()
	]
});