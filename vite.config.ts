import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { localVisualAssetsPlugin } from './viteLocalVisualAssets.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_')
  const productionVisualAssetsEnabled =
    environment.VITE_ENABLE_TSC_REVIEW_VISUAL_ASSETS === 'true'

  return {
    plugins: [
      react(),
      localVisualAssetsPlugin({
        productionEnabled: productionVisualAssetsEnabled,
      }),
    ],
  }
})
