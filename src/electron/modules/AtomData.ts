/**
 * Load atoms info.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {app} from "electron";

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
/**
 * Data from file
 * @notExported
 */
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

/**
 * Appearance of the various atoms types
 * @notExported
 */
interface AtomAppearance {

	/** Element symbol */
	symbol: string;

	/** Covalent radii (in Angstrom). 1.6 if unknown */
	rCov: number;

	/** Van der Waals radii (in Angstrom). 2.0 if unknown */
	rVdW: number;

	/** Atom color as an hex string (#RRGGBB) */
	color: string;

    /** Maximum number of bonds for the element type */
    maxBonds: number;
}

class AtomData {

    private static instance: AtomData;
	private readonly data;
	private readonly symbol2an = new Map<string, number>();

	/**
	 * Build the class by loading the atomic data from file
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
	 * Return other information on the atom with given Z value
	 *
	 * @param atomZ - Z value of the atom that should be retrieved
	 * @returns Structure containing symbol, radii, max number of bonds and color
	 */
	atomicData(atomZ: number): AtomAppearance {

		const {red, green, blue, symbol, rCov, rVdW, maxBonds} = this.data[atomZ];

		const rs = red.toString(16).toUpperCase().padStart(2, "0");
		const gs = green.toString(16).toUpperCase().padStart(2, "0");
		const bs = blue.toString(16).toUpperCase().padStart(2, "0");

		const color = "#" + rs + gs + bs;

		return {
			symbol,
			rCov,
			rVdW,
			color,
			maxBonds
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
 * Convert the atom Z value into atom symbol
 *
 * @param atomZ - Atom Z value
 * @returns The corresponding atomic symbol
 */
export const getAtomicSymbol = (atomZ: number): string => AtomData.getInstance().atomicSymbol(atomZ);

/**
 * Return other information on the atom with given Z value
 *
 * @param atomZ - Z value of the atom that should be retrieved
 * @returns Structure containing symbol, radii, max number of bonds and color
 */
export const getAtomData = (atomZ: number): AtomAppearance => AtomData.getInstance().atomicData(atomZ);
