import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: '',
  },
  typescript: {
    strict: true,
  },
})
