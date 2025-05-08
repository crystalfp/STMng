/**
 * Load atoms info.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {readFileSync} from "node:fs";
import {publicDirPath} from "./GetPublicPath";

// ##############################################################################
// #                                                                            #
// #                  Open Babel file: element.txt                              #
// #                                                                            #
// #  Some portions Copyright (c) 2001-2009 Geoffrey R. Hutchison               #
// #  Part of the Open Babel package, under the GNU General Public License (GPL)#
// #                                                                            #
// #  Created from the Blue Obelisk Cheminformatics Data Repository             #
// #  Direct Source: http://www.blueobelisk.org/                                #
// #       http://www.blueobelisk.org/repos/blueobelisk/elements.xml            #
// #  (includes furhter bibliographic citation information)                     #
// #                                                                            #
// #  Allred and Rochow Electronegativity from:                                 #
// #  http://www.hull.ac.uk/chemistry/electroneg.php?type=Allred-Rochow         #
// #                                                                            #
// #  Columns represent:  (used by data.cpp:OBElementTable and OBElement)       #
// #   - atomic number (used as an index to the vector as well)                 #
// #   - elemental symbol                                                       #
// #   - Allred and Rochow electronegativity  0.0 if unknown                    #
// #   - covalent radii (in Angstrom)         1.6 if unknown                    #
// #       from http://dx.doi.org/10.1039/b801115j                              #
// #   - "bond order" radii -- ignored, but included for compatibility          #
// #   - van der Waals radii (in Angstrom)    2.0 if unknown                    #
// #       from http://dx.doi.org/10.1021/jp8111556                             #
// #   - maximum bond valence                 6 if unknown                      #
// #   - IUPAC recommended atomic masses (in amu)                               #
// #   - Pauling electronegativity            0.0 if unknown                    #
// #   - ionization potential (in eV)         0.0 if unknown                    #
// #   - electron affinity (in eV)            0.0 if unknown                    #
// #   - RGB values (defaults for visualization)                                #
// #   - element name (in English)                                              #
// #                                                                            #
// ##############################################################################

/**
 * Data from atom-data.json file
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

	/** RGB color for visualization (format: "#RRGGBB") */
	color: string;

	/** The bonding strength. Bond strength is sqrt(bondStrengthI*bondStrengthJ) */
	bondStrength: number;
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

	/** The bonding strength. Bond strength is sqrt(bondStrengthI*bondStrengthJ) */
	bondStrength: number;
}

class AtomData {

    private static instance: AtomData;
	private readonly data;
	private readonly symbol2atomZ = new Map<string, number>();

	/**
	 * Build the class by loading the atomic data from file
	 */
	private constructor() {

		const filename = publicDirPath("atom-data.json");
		this.data = JSON.parse(readFileSync(filename, "utf8")) as OneAtomData[];

		const len = this.data.length;
		for(let i=1; i < len; ++i) {
			const {symbol} = this.data[i];
			this.symbol2atomZ.set(symbol, i);
			this.symbol2atomZ.set(symbol.toLowerCase(), i);
			this.symbol2atomZ.set(symbol.toUpperCase(), i);
		}

		// Add Deuterium
		this.symbol2atomZ.set("D", 1);
		this.symbol2atomZ.set("d", 1);
	}

	/**
	 * Convert atomic symbol to atom Z
	 *
	 * @param symbol - Atomic symbol as read from the structure file
	 * @returns The atom Z value or zero if it is an invalid symbol
	 */
	atomicNumber(symbol: string): number {
		return this.symbol2atomZ.get(symbol) ?? 0;
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

		const {symbol, rCov, rVdW, maxBonds, color, bondStrength} = this.data[atomZ];

		return {
			symbol,
			rCov,
			rVdW,
			color,
			maxBonds,
			bondStrength
		};
	}

	// > Access the singleton instance
	/**
	 * Access the singleton instance
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
 * @returns The atom Z value or zero if it is an invalid symbol
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
