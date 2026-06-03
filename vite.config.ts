// <reference types="vitest/config" />
import {defineConfig} from "vite";
import electron from "vite-plugin-electron";
import vueDevTools from "vite-plugin-vue-devtools";
import cleanPlugin from "vite-plugin-clean-pattern";
import vue from "@vitejs/plugin-vue";
import {fileURLToPath, URL} from "node:url";
// import dts from "vite-plugin-dts";
/* oxlint-disable require-unicode-regexp */
const isProd = process.env.NODE_ENV === "production";

// https://vitejs.dev/config/
export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("src", import.meta.url))
        },
        // preserveSymlinks: true
    },
    optimizeDeps: {
        exclude: [
            ".git", ".vscode", ".gemini", ".github", "linux-scripts",
            "local-doc", "release", "save", "other",
            "test-data", "work", "tests"
        ],
        holdUntilCrawlEnd: false
    },
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
                vite: {
                    build: {
                        minify: isProd,
                        reportCompressedSize: false,
                        rolldownOptions: {
                            output: {
                                intro: "globalThis.modulePath = new URL('file:' + __filename).href",
                            }
                        },
                    },
                }
            },
            {
                entry: "src/electron/preload.ts",
                // onstart(options): void {
                //     // Notify the Renderer-Process to reload the page when the Preload-Scripts build
                //     // is complete, instead of restarting the entire Electron App.
                //     options.reload();
                // },
                vite: {
                    build: {
                        reportCompressedSize: false,
                    }
                }
            },
        ]),
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
        rolldownOptions: {
            output: {
                codeSplitting: {
                    groups: [
                        {
                            name: "three",
                            test: /node_modules[\\/]three/
                        },
                        {
                            name: "troika",
                            test: /node_modules[\\/]troika-three-text/
                        },
                        {
                            name: "vue",
                            test: /node_modules[\\/](vue|pinia)/ // Covers also vuetify
                        },
                    ]
                }
            }
        }
    },
    server: {
        warmup: {
            clientFiles: [

                "./src/components/LayoutClient.vue",
                "./src/components/Viewer3D.vue",
                "./src/components/ControlsContainer.vue",
            ],
        },
        watch: {
            ignored: [
                "**/local-doc/**",
                "**/release/**",
                "**/save/**",
                "**/other/**",
                "**/test-data/**",
                "**/work/**",
                "**/tests/**",
                "**/linux-scripts/**",
            ],
        }
    },
});
