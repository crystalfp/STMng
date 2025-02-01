
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";

export default {
	input: "src/electron/fingerprint/Worker.ts",
	output: {
		file: "dist/Worker.js",
		format: "es",
		sourcemap: false,
	},
	plugins: [
		resolve({
			preferBuiltins: true,
			exportConditions: ["node"]
		}),
		json(),
		commonjs({transformMixedEsModules: true}),
		terser(),
		typescript({
			include: ["src/electron/fingerprint/*.ts"],
			tsconfig: false,
			outputToFilesystem: true,
			sourceMap: false,
			compilerOptions: {
				target: "esnext",
			    "paths": {
      				"@/*": ["src/*"]
    			},
   				"baseUrl": ".",
			}
		}),
	]
};
