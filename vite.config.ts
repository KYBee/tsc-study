import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { localVisualAssetsPlugin } from './viteLocalVisualAssets.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localVisualAssetsPlugin()],
})
