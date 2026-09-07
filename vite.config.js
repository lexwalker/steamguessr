import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the build works from any folder on any static host (GitHub Pages, Cloudflare Pages, a plain web server)
export default defineConfig({
  base: './',
  plugins: [react()],
})
