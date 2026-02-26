/**
 * Reader for ENERGY auxiliary file
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-01-17
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
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import {readFileSync} from "node:fs";
import type {Structure} from "@/types";

/**
 * Read the auxiliary file ENERGY
 *
 * @param filename - Filename to be read as ENERGY
 * @param mainStructures - The already read main structures
 * @param appendFrom - Position in the array of structures where to add the energy
 * @param energyPerAtom - True if the energy file has energy per atom instead of per structure
 * @returns Main structures trajectory
 * @throws Error.
 * Missing main structures
 */
export const readAuxENERGY = (filename: string,
							  mainStructures: Structure[],
							  appendFrom: number,
							  energyPerAtom: boolean): Structure[] => {

	// Sanity check
	const mainLength = mainStructures?.length ?? 0;
	if(mainLength === 0) throw Error("Missing main structures");
	if(appendFrom >= mainLength) {
		throw Error(`Invalid append position ${appendFrom} on length ${mainLength}`);
	}

	// Read and clean energies
	const energiesRaw = readFileSync(filename, "utf8") + "\n";
	const energies = energiesRaw
								.replaceAll(/\s+/g, "\n")
								.split("\n")
								.map((line) => Number.parseFloat(line));

	const currentLength = mainLength - appendFrom;
	if(energies.length < currentLength) {
		throw Error(`Too few energies read (${energies.length} instead of ${currentLength})`);
	}

	for(let i=0; i < currentLength; ++i) {
		const structure = mainStructures[i+appendFrom];
		const energyFromFile = energies[i];
		structure.extra.energy = energyPerAtom ?
										energyFromFile :
										energyFromFile/structure.atoms.length;
	}

	return mainStructures;
};
