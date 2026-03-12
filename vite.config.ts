/// <reference types="vitest/config" />
import {defineConfig} from "vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import vueDevTools from "vite-plugin-vue-devtools";
import cleanPlugin from "vite-plugin-clean-pattern";
import vue from "@vitejs/plugin-vue";
import {fileURLToPath, URL} from "node:url";
// import dts from "vite-plugin-dts";
// const importMetaUrlPolyfillVariableName = '__import_meta_url__';

// https://vitejs.dev/config/
export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("src", import.meta.url))
        },
        preserveSymlinks: true
    },
    optimizeDeps: {
        exclude: [".git", ".vscode", "doc", "release", "save", "other", "bugs",
                  "test-data", "proto-test", "work", "tests"],
        holdUntilCrawlEnd: false
    },
    // define: {
    //     __VUE_PROD_DEVTOOLS__: "false",
    // },
    plugins: [
        // dts({
        //     tsconfigPath: './tsconfig.json',
        //     rollupTypes: true,
        //     entryRoot: 'src',
        // }),
        vue(),
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
        cleanPlugin({
            targetFiles: ["dist", "dist-electron"]
        })
    ],
    build: {
        assetsInlineLimit: 8096,
        reportCompressedSize: false,
        emptyOutDir: true,
        chunkSizeWarningLimit: 700,
        // rolldownOptions: {
        //     output.intro: `
        //     `
        // },
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
