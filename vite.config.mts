import {defineConfig} from "vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
    resolve: {
        alias: {
            "@":  path.resolve(__dirname, "./src")
        }
    },
    optimizeDeps: {
        exclude: ["doc", "release", "tests"],
    },
    plugins: [
        vue(),
        electron([
            {
                // Main-Process entry file of the Electron App.
                entry: "src/electron/main.ts",
            },
            {
                entry: "src/electron/preload.ts",
                onstart(options) {
                    // Notify the Renderer-Process to reload the page when the Preload-Scripts build
                    // is complete, instead of restarting the entire Electron App.
                    options.reload();
                },
            },
        ]),
        renderer(),
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
                        "vue-tippy",
                        "pinia",
                        "vuetify",
                        "@mdi/js",
                        "@yeliulee/vue-mdi-svg",
                    ],
                    three: [
                        "three",
                        "three-spritetext"
                    ]
                }
            }
        }
    },
});
