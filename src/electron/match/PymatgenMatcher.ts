/**
 * Match current structure to structures in collections
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-11-24
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import {closeSync, openSync, readFileSync} from "node:fs";
import {StructureMatcher} from "./StructureMatcher";
import {getPrimitiveStructure, getReducedStructure} from "./Structure";
import {dataToSNL} from "./ConvertStructure";
import {publicDirPath} from "../modules/GetPublicPath";
import type {SNL} from "./types";

// Cache for the reduced structure files
let cachedIndex: [structureIdx: number, offset: number][] = [];
const cachedData: SNL[] = [];

export class PymatgenMatcher {

	private readonly initialLtol: number;
	private readonly initialStol: number;
	private readonly initialAngleTol: number;
	private readonly dbPrefix: string = "";

	/**
	 * Initialize the prototype matcher.
	 *
	 * Tolerances as defined in StructureMatcher. Tolerances will be
     * gradually decreased until only a single match is found (if possible).
	 *
	 * @param preprocessedPrototypes - The list of prototypes preprocessed from the Aflow list
	 * @param initialLtol - Fractional length tolerance
	 * @param initialStol - Site tolerance
	 * @param initialAngleTol - Angle tolerance
	 */
	constructor(initialLtol = 0.2,
        		initialStol = 0.3,
        		initialAngleTol = 5) {

		this.initialLtol = initialLtol;
		this.initialStol = initialStol;
		this.initialAngleTol = initialAngleTol;

		// The reduced structure files have been already loaded
		if(cachedIndex.length > 0) return;

		// Filename without extension for the files composing the reduced
		// structure needed by the pymatgen matcher (two files: .idx, .dat)
		this.dbPrefix = publicDirPath("reduced-collection").replaceAll("\\", "/");

		const indexRaw = readFileSync(`${this.dbPrefix}.idx`, "utf8");
		cachedIndex = JSON.parse(indexRaw) as [structureIdx: number, offset: number][];

		const fd = openSync(`${this.dbPrefix}.dat`, "r");

		cachedData.length = 0;
		for(const entry of cachedIndex) {
			const snl = dataToSNL(fd, entry[1]);
			cachedData.push(snl);
		}
		closeSync(fd);
	}

	/**
	 * Match input structure to the list of prototypes
	 *
	 * @param sm - The structure matcher class instance
	 * @param reducedStructure - The reduced structure from the input one
	 * @returns List of found prototypes
	 */
	private static matchPrototype(sm: StructureMatcher, reducedStructure: SNL): number[] {

        const indices: number[] = [];
		for(let i=0; i < cachedIndex.length; ++i) {

			// Adapt to the preprocessed format of the aflow library
			const snl = cachedData[i];

			// Since both structures are already reduced, we can skip the structure reduction step
            const match = sm.fitAnonymous(snl, reducedStructure, true);
            if(match?.length) indices.push(cachedIndex[i][0]);
		}
        return indices;
	}

	/**
	 * Get prototype(s) structures for a given input structure
	 *
	 * If you use this method in your work, please cite the appropriate AFLOW publication:
	 *
	 *	Mehl, M. J., Hicks, D., Toher, C., Levy, O., Hanson, R. M., Hart, G., & Curtarolo,
	 *	S. (2017). The AFLOW library of crystallographic prototypes: part 1. Computational
	 *	Materials Science, 136, S1-S828. https://doi.org/10.1016/j.commatsci.2017.01.017
	 *
	 * @param snl - The structure in SNL format
	 * @returns A list of dicts with keys "snl" for the matched prototype and
	 *              "tags", a dict of tags ("mineral", "strukturbericht" and "aflow") of that
	 *              prototype. This should be a list containing just a single entry, but it is
	 *              possible a material can match multiple prototypes.
	 */
	getPrototypes(snl: SNL): number[] {

		const reducedStructure = getReducedStructure(snl);
		const primitiveStructure = getPrimitiveStructure(reducedStructure);

		const sm = new StructureMatcher(
			this.initialLtol,
            this.initialStol,
            this.initialAngleTol,
		);

		let prototypes = PymatgenMatcher.matchPrototype(sm, primitiveStructure);
        while(prototypes.length > 1) {

			sm.ltol *= 0.8;
            sm.stol *= 0.8;
            sm.angleTol *= 0.8;
            const prototypes1 = PymatgenMatcher.matchPrototype(sm, primitiveStructure);

			if(prototypes1.length === 0) break;
			prototypes = prototypes1;
            if(sm.ltol < 0.01) break;
		}

		return prototypes;
	}
}
