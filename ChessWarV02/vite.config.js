import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
const resolveBase = () => {
    const explicit = process.env.VITE_BASE ?? process.env.BASE_URL;
    if (explicit) {
        return explicit.endsWith('/') ? explicit : `${explicit}/`;
    }
    const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
    if (!repo || repo.endsWith('.github.io')) {
        return '/';
    }
    return `/${repo}/`;
};
// https://vite.dev/config/
export default defineConfig({
    base: resolveBase(),
    plugins: [
        vue(),
        vueDevTools(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        },
    },
});
