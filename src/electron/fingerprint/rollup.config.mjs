
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

export default {
	input: "Worker.ts",
	output: {
		file: "../../../public/Worker.js",
		format: "cjs",
		sourcemap: false,
	},
	plugins: [
		resolve({
			preferBuiltins: true,
			exportConditions: ["node"]
		}),
		commonjs({transformMixedEsModules: true}),
		terser(),
		typescript({
			include: [
				"OganovValleFingerprint.ts",
				"Helpers.ts",
				"Slab.ts",
				"Smooth.ts",
				"Worker.ts",
				"../modules/Helpers.ts",
			],
			tsconfig: false,
			outputToFilesystem: true,
			sourceMap: false,
			compilerOptions: {
				target: "esnext",
			    paths: {
      				"@/*": ["../../*"]
    			},
   				baseUrl: ".",
				allowSyntheticDefaultImports: true
			}
		}),
	]
};
