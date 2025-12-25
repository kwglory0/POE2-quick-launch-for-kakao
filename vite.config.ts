import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'
import packageJson from './package.json'

manifest.version = packageJson.version

export default defineConfig({
  plugins: [crx({ manifest })],
})
