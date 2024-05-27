/**
 * Load atoms info
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {app} from "electron";
import type {AtomAppearance} from "../../types";

// ##############################################################################
// #                                                                            #
// #                   Open Babel file: element.txt                             #
// #                                                                            #
// #  Some portions Copyright (c) 2001-2005 Geoffrey R. Hutchison               #
// #  Part of the Open Babel package, under the GNU General Public License (GPL)#
// #                                                                            #
// #  Created from the Blue Obelisk Cheminformatics Data Repository             #
// #  Direct Source: http://www.blueobelisk.org/                                #
// #       http://www.blueobelisk.org/repos/blueobelisk/elements.xml            #
// #  (includes furhter bibliographic citation information)                     #
// #                                                                            #
// #  Columns represent:  (used by data.cpp:OBElementTable and OBElement)       #
// #   - atomic number (used as an index to the vector as well)      [NOT HERE] #
// #   - elemental symbol                                                       #
// #   - covalent radii (in Angstrom)         1.6 if unknown                    #
// #   - "bond order" radii                                          [NOT HERE] #
// #   - van der Waals radii (in Angstrom)    2.0 if unknown                    #
// #   - maximum bond valence         		  6 if unknown                      #
// #   - IUPAC recommended atomic masses (in amu)                               #
// #   - Pauling electronegativity            0.0 if unknown                    #
// #   - ionization potential (in eV)         0.0 if unknown                    #
// #   - electron affinity (in eV)            0.0 if unknown                    #
// #   - RGB values (defaults for visualization)                                #
// #   - element name (in English)                                              #
// #                                                                            #
// ##############################################################################

interface OneAtomData {

	/** Element symbol */
	symbol: string;

	/** Covalent radii (in Angstrom). 1.6 if unknown */
	rCov: number;

	/** Van der Waals radii (in Angstrom). 2.0 if unknown */
	rVdW: number;

	/** Maximum bond valence. 6 if unknown */
	maxBonds: number;

	/** IUPAC recommended atomic masses (in amu) */
	mass: number;

	/** Pauling electronegativity. 0.0 if unknown */
	elNeg: number;

	/** Ionization potential (in eV). 0.0 if unknown */
	ionization: number;

	/** Electron affinity (in eV). 0.0 if unknown */
	elAffinity: number;

	/** RGB color for visualization */
	red: number;
	green: number;
	blue: number;

	/** Element name (in English) */
	name: string;
}

class AtomData {

    private static instance: AtomData;
	private readonly data;
	private readonly symbol2an = new Map<string, number>();

	/**
	 * Build the class by loading the atomic data
	 */
	private constructor() {
		const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
		const DIST = path.join(mainSourceDirectory, "..", "dist");
		const publicDir = app.isPackaged ? DIST : path.join(mainSourceDirectory, "..", "public");
		const filename = path.join(publicDir, "atom-data.json");

		this.data = JSON.parse(fs.readFileSync(filename, "utf8")) as OneAtomData[];

		const len = this.data.length;
		for(let i=1; i < len; ++i) {
			const {symbol} = this.data[i];
			this.symbol2an.set(symbol, i);
			this.symbol2an.set(symbol.toLowerCase(), i);
			this.symbol2an.set(symbol.toUpperCase(), i);
		}
	}

	/**
	 * Convert atomic symbol to atom Z
	 *
	 * @param symbol - Atomic symbol as read from the structure file
	 * @returns The atom Z value
	 */
	atomicNumber(symbol: string): number {
		return this.symbol2an.get(symbol) ?? 0;
	}

	/**
	 * Convert the atom Z value into atom symbol
	 *
	 * @param atomZ - Atom Z value
	 * @returns The corresponding atomic symbol
	 */
	atomicSymbol(atomZ: number): string {
		return this.data[atomZ].symbol;
	}

	/**
	 * Return other information on the atom with Z value
	 *
	 * @param atomZ - Z value of the atom that should be retrieved
	 * @returns Structure containing symbol, radii, max number of bonds and color
	 */
	atomicData(atomZ: number): AtomAppearance {

		const rs = this.data[atomZ].red.toString(16).toUpperCase().padStart(2, "0");
		const gs = this.data[atomZ].green.toString(16).toUpperCase().padStart(2, "0");
		const bs = this.data[atomZ].blue.toString(16).toUpperCase().padStart(2, "0");

		return {
			symbol:   this.data[atomZ].symbol,
			rCov: 	  this.data[atomZ].rCov,
			rVdW:	  this.data[atomZ].rVdW,
			color:	  `#${rs}${gs}${bs}`,
			maxBonds: this.data[atomZ].maxBonds
		};
	}

	// > Access the singleton instance
	/**
	 * Access the singleton instance.
	 *
	 * This is the static method that controls the access to the singleton instance.
	 * This implementation let you subclass the Singleton class while keeping
	 * just one instance of each subclass around.
	 *
	 * @returns The Atom Data object
	 */
    static getInstance(): AtomData {

        if(!AtomData.instance) {
            AtomData.instance = new AtomData();
        }

        return AtomData.instance;
    }
}

/**
 * Convert atomic symbol to atom Z
 *
 * @param symbol - Atomic symbol as read from the structure file
 * @returns The atom Z value
 */
export const getAtomicNumber = (symbol: string): number => AtomData.getInstance().atomicNumber(symbol);

/**
 * Return other information on the atom with Z value
 *
 * @param atomZ - Z value of the atom that should be retrieved
 * @returns Structure containing symbol, radii and color
 */
export const getAtomicData = (atomZ: number): AtomAppearance => AtomData.getInstance().atomicData(atomZ);

/**
 * Convert the atom Z value into atom symbol
 *
 * @param atomZ - Atom Z value
 * @returns The corresponding atomic symbol
 */
export const getAtomicSymbol = (atomZ: number): string => AtomData.getInstance().atomicSymbol(atomZ);
