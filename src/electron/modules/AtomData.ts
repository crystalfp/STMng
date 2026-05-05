/**
 * Access atoms info.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
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

/**
 * One atom type data
 * @notExported
 */
export interface AtomInfo {

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

	/** Atomic mass */
	mass: number;
}

class AtomData {

    private static instance: AtomData;
	private data: AtomInfo[] = [];
	private readonly symbol2atomZ = new Map<string, number>();

	/**
	 * Build the class
	 */
	private constructor() {
		this.data = [];
		this.symbol2atomZ.clear();
	}

	/**
	 * Load atom data
	 *
	 * @param data - Atom data to load
	 */
	loadData(data: AtomInfo[]): void {

		this.data = data;
		this.symbol2atomZ.clear();
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
	 * Access the atom data
	 *
	 * @returns The atom data table loaded
	 */
	getData(): AtomInfo[] {

		return this.data;
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

		return this.data[atomZ]?.symbol ?? "Xx";
	}

	/**
	 * Return other information on the atom with given Z value
	 *
	 * @param atomZ - Z value of the atom that should be retrieved
	 * @returns Structure containing various atom data
	 */
	atomicData(atomZ: number): AtomInfo {

		let data = this.data[atomZ];
		if(!data) data = this.data[0];

		const {symbol, rCov, rVdW, maxBonds, color, bondStrength, mass} = data;

		return {
			symbol,
			rCov,
			rVdW,
			color,
			maxBonds,
			bondStrength,
			mass
		};
	}

	/**
	 * Return the atomic number given the atomic mass
	 *
	 * @param mass - Atomic mass
	 * @returns Corresponding Z value
	 */
	atomicNumberByMass(mass: number): number {

		let tentativeZ = 1;
		let delta = Number.POSITIVE_INFINITY;
		for(let z=1; z < this.data.length; ++z) {
			const d = Math.abs(this.data[z].mass - mass);
			if(d === 0) return z;
			if(d < delta) {
				tentativeZ = z;
				delta = d;
			}
		}
		return tentativeZ;
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
 * Convert the atom Z value into atomic symbol
 *
 * @param atomZ - Atom Z value
 * @returns The corresponding atomic symbol
 */
export const getAtomicSymbol = (atomZ: number): string => AtomData.getInstance().atomicSymbol(atomZ);

/**
 * Return information on the atom with given Z value
 *
 * @param atomZ - Z value of the atom that should be retrieved
 * @returns Structure containing the atom data
 */
export const getAtomData = (atomZ: number): AtomInfo => AtomData.getInstance().atomicData(atomZ);

/**
 * Return the atomic number given the atomic mass
 *
 * @param mass - Atomic mass
 * @returns Corresponding Z value
 */
export const getAtomicNumberByMass = (mass: number): number => AtomData.getInstance().atomicNumberByMass(mass);

/**
 * Load atom data
 *
 * @param data - Atom data to load
 */
export const loadData = (data: AtomInfo[]): void => AtomData.getInstance().loadData(data);

/**
 * Access the atom data
 *
 * @returns The atom data table loaded
 */
export const getData = (): AtomInfo[] => AtomData.getInstance().getData();
