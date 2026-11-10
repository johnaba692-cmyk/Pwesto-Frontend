import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const entryFile = fileURLToPath(new URL('./src/main.jsx', import.meta.url));
const frontendDirectory = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, frontendDirectory, 'VITE_');
    const backendUrl = (env.VITE_BACKEND_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');

    try {
        const parsedBackendUrl = new URL(backendUrl);
        if (!['http:', 'https:'].includes(parsedBackendUrl.protocol)) {
            throw new Error();
        }
    } catch {
        throw new Error('VITE_BACKEND_URL must be a valid absolute HTTP or HTTPS URL.');
    }

    return {
        root: '.',
        base: './',
        plugins: [react()],
        server: {
            host: '127.0.0.1',
            port: 5173,
            strictPort: false,
            proxy: {
                '^/$': {
                    target: backendUrl,
                    rewrite: () => '/pwesto'
                },
                '/api': backendUrl,
                '/assets': backendUrl,
                '/favicon.ico': backendUrl
            }
        },
        build: {
            outDir: mode === 'backend' ? '../Pwesto Backend/public/assets' : 'dist',
            emptyOutDir: mode !== 'backend',
            rollupOptions: {
                input: entryFile,
                output: {
                    entryFileNames: 'pwesto-react.js',
                    chunkFileNames: '[name].js',
                    assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.css')
                        ? 'pwesto-react.css'
                        : '[name][extname]'
                }
            }
        }
    };
});
