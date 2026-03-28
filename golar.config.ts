import {defineConfig} from "golar/unstable";
import "@golar/vue";

export default defineConfig({
	typecheck: {
		include: ["./src/**/*.vue"],
		exclude: ["./src/cpp/spglib-2.7.0/**", "./bugs/**", "./work/**", "./test/**", "./other/**"],
	},
});
