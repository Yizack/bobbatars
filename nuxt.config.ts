import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  modules: [
    "@nuxt/ui",
    "@nuxt/eslint",
    "@nuxthub/core",
    "nuxt-auth-utils",
    "nuxt-ui-colors-no-inline"
  ],

  devtools: {
    enabled: true
  },

  app: {
    head: {
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1",
      link: [
        { rel: "preconnect", href: "https://habbohistory.com" }
      ]
    }
  },

  css: ["~/assets/css/main.css"],

  colorMode: {
    preference: "dark",
    fallback: "dark",
    classSuffix: ""
  },

  ui: {
    colorMode: true
  },

  features: {
    inlineStyles: false
  },

  experimental: {
    typedPages: true
  },

  compatibilityDate: "2026-11-04",

  hub: {
    cache: true,
    db: {
      dialect: "sqlite",
      casing: "snake_case"
    }
  },

  typescript: {
    strict: true
  },

  eslint: {
    config: {
      autoInit: false,
      stylistic: true
    }
  }
});
