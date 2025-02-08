
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

export default {
	input: "src/electron/fingerprint/Worker.ts",
	output: {
		file: "public/Worker.js",
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
				"src/electron/fingerprint/OganovValleFingerprint.ts",
				"src/electron/fingerprint/Helpers.ts",
				"src/electron/fingerprint/Slab.ts",
				"src/electron/fingerprint/Smooth.ts",
				"src/electron/fingerprint/Worker.ts",
				"src/electron/modules/Helpers.ts",
			],
			tsconfig: false,
			outputToFilesystem: true,
			sourceMap: false,
			compilerOptions: {
				target: "esnext",
			    paths: {
      				"@/*": ["../../*"]
    			},
   				baseUrl: "src/electron/fingerprint",
				allowSyntheticDefaultImports: true
			}
		}),
	]
};
