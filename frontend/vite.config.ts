import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Determine proxy target based on environment
// In Docker, use service name; locally, use localhost
const getProxyTarget = () => {
    // Check if we're in Docker (backend service should be accessible)
    if (process.env.VITE_API_PROXY_TARGET) {
        return process.env.VITE_API_PROXY_TARGET;
    }
    // Default to localhost for local development
    return 'http://localhost:5001';
};

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        host: '0.0.0.0', // Allow connections from outside container
        proxy: {
            '/api': {
                target: getProxyTarget(),
                changeOrigin: true,
            },
        },
    },
})

