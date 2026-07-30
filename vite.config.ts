import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { part2LocalAssetsPlugin } from './vitePart2LocalAssets.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), part2LocalAssetsPlugin()],
})
