/**
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import {defineConfig} from "rolldown";

export default defineConfig({
	input: "src/electron/fingerprint/Worker.ts",
	output: {
		file: "public/Worker.js",
		format: "cjs",
		sourcemap: false,
	},
	plugins: [
		terser(),
		typescript({
			include: [
				"src/electron/fingerprint/OganovValleFingerprint.ts",
				"src/electron/fingerprint/DotMatrixFingerprint.ts",
				"src/electron/fingerprint/Helpers.ts",
				"src/electron/fingerprint/UpperTriangularMatrix.ts",
				"src/electron/fingerprint/Slab.ts",
				"src/electron/fingerprint/Smooth.ts",
				"src/electron/fingerprint/Worker.ts",
				"src/electron/modules/AtomData.ts",
				"src/electron/modules/Helpers.ts",
				"src/services/SharedConstants.ts",
				"src/types/index.ts"
			],
			tsconfig: "tsconfig.json",
			outputToFilesystem: true,
			sourceMap: false,
			compilerOptions: {
				target: "esnext",
			    paths: {
      				"@/*": ["./src/*"]
    			},
				allowSyntheticDefaultImports: true,
				resolveJsonModule: true,
				declarationDir: "public",
				allowImportingTsExtensions: false
			},
		}),
	]
});
