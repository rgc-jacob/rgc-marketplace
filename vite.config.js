import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: CI sets BASE_PATH (e.g. /repo/). Must start with / and usually end with /.
function normalizeBase(p) {
  if (p == null || p === '' || p === '/') return '/'
  let b = String(p).trim()
  if (!b.startsWith('/')) b = `/${b}`
  return b.endsWith('/') ? b : `${b}/`
}
const base = normalizeBase(process.env.BASE_PATH)

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
})
