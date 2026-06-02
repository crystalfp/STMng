import {defineConfig} from "golar/unstable";
import "@golar/vue";

export default defineConfig({
	typecheck: {
		include: ["./src/**/*.vue", "./src/**/*.ts", "*.ts"],
		exclude: ["./src/cpp/spglib-2.7.0/**", "./bugs/**", "./work/**", "./test/**", "./other/**"],
	},
});
