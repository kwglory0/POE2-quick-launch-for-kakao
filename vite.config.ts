import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import packageJson from './package.json';

manifest.version = packageJson.version;

export default defineConfig(({ mode }) => {
    const isDev = mode === 'development';

    return {
        plugins: [crx({ manifest })],
        server: {
            port: 5173,
            strictPort: true,
            hmr: {
                port: 5173
            },
            cors: true,
            headers: {
                'Access-Control-Allow-Origin': '*'
            }
        },
        build: {
            // Disable minification in dev mode for readable stack traces
            minify: isDev ? false : true,
            // Enable source maps in dev mode
            sourcemap: isDev ? 'inline' : false
        }
    };
});
