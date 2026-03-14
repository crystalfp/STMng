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
	input: "Worker.ts",
	output: {
		file: "../../../public/Worker.js",
		format: "cjs",
		sourcemap: false,
	},
	checks: {
		pluginTimings: false
	},
	plugins: [
		terser(),
		typescript({
			include: [
				"OganovValleFingerprint.ts",
				"DotMatrixFingerprint.ts",
				"Helpers.ts",
				"UpperTriangularMatrix.ts",
				"Slab.ts",
				"Smooth.ts",
				"Worker.ts",
				"../modules/AtomData.ts",
				"../modules/Helpers.ts",
				"../../services/SharedConstants.ts"
			],
			tsconfig: "../../../tsconfig.json",
			outputToFilesystem: true,
			sourceMap: false,
			compilerOptions: {
				target: "esnext",
			    paths: {
      				"@/*": ["../../*"]
    			},
				allowSyntheticDefaultImports: true,
				resolveJsonModule: true,
				declarationDir: "../../../public",
				allowImportingTsExtensions: false
			},
		}),
	]
});
