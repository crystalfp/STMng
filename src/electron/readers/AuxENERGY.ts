/**
 * Reader for ENERGY auxiliary file
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-01-17
 */
import {readFileSync} from "node:fs";
import type {Structure} from "@/types";

/**
 * Read the auxiliary file ENERGY
 *
 * @param filename - Filename to be read as ENERGY
 * @param mainStructures - The already read main structures
 */
export const readAuxENERGY = (filename: string, mainStructures: Structure[]): Structure[] => {

	// Sanity check
	if(mainStructures.length === 0) throw Error("Missing main structures");

	const energiesRaw = readFileSync(filename, "utf8") + "\n";
	const energies = energiesRaw
								.replaceAll(/\s+/g, "\n")
								.split("\n")
								.map((line) => Number.parseFloat(line));

	if(energies.length < mainStructures.length) {
		throw Error(`Too few energies read (${energies.length} instead of ${mainStructures.length})`);
	}

	let idx = 0;
	for(const structure of mainStructures) {
		structure.extra["energy"] = energies[idx++];
	}

	return mainStructures;
};
