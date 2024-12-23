import {defineConfig} from "vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import vueDevTools from "vite-plugin-vue-devtools";
import vue from "@vitejs/plugin-vue";
import {fileURLToPath, URL} from 'node:url';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
/** @type {import('vite').UserConfig} */
export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL('./src', import.meta.url))
        },
        preserveSymlinks: true
    },
    optimizeDeps: {
        exclude: ["doc", "release", "save", "others", "bugs", "test-data"],
        holdUntilCrawlEnd: false
    },
    define: {
        __VUE_PROD_DEVTOOLS__: "false",
    },
    plugins: [
        vue(),
		dts({
		  tsconfigPath: './tsconfig.json',
		  rollupTypes: true,
		  entryRoot: 'src',
		}),
        electron([
            {
                // Main-Process entry file of the Electron App.
                entry: "src/electron/main.ts",
            },
            {
                entry: "src/electron/preload.ts",
                onstart(options): void {
                    // Notify the Renderer-Process to reload the page when the Preload-Scripts build
                    // is complete, instead of restarting the entire Electron App.
                    options.reload();
                },
            },
        ]),
        renderer(),
        vueDevTools(),
    ],
    build: {
        assetsInlineLimit: 8096,
        reportCompressedSize: false,
        emptyOutDir: true,
        chunkSizeWarningLimit: 600,
        rollupOptions: {
            output: {
                manualChunks: {
                    vue: [
                        "vue",
                        "vue-router",
                        "pinia",
                        "vuetify",
                        "@mdi/js",
                    ],
                    three: [
                        "three"
                    ],
                    troika: [
                        "troika-three-text"
                    ]
                }
            },
        }
    },
});
