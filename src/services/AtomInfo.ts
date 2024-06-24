/**
 * Cache the atom data on the client.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import {getAtomData} from "@/services/RoutesClient";
import type {AtomAppearance} from "@/types";
import log from "electron-log";

class AtomInfo {

    private static instance: AtomInfo;
	private data: AtomAppearance[] = [];
	private readonly symbol2an = new Map<string, number>();

	/**
	 * Copy the atoms data from the main process to the client
	 */
	init(): void {

		getAtomData()
			.then((dataRaw) => {
				this.data = JSON.parse(dataRaw) as AtomAppearance[];

				const len = this.data.length;
				for(let i=1; i < len; ++i) {
					const {symbol} = this.data[i];
					this.symbol2an.set(symbol, i);
					this.symbol2an.set(symbol.toLowerCase(), i);
					this.symbol2an.set(symbol.toUpperCase(), i);
				}
			})
			.catch((error: Error) => {
				log.error("Cannot initialize atom's data. Error:", error.message);
			});
	}

	/**
	 * Retrieve all data pertaining to the given atomic number
	 *
	 * @param atomZ - Atom number for which the data should be retrieved
	 * @returns All data pertaining to the given atomic number
	 */
	atomData(atomZ: number): AtomAppearance {
		return this.data[atomZ];
	}

	/**
	 * Retrieve the atomic number for a given atomic symbol
	 *
	 * @param symbol - Atomic symbol for which the atomic number should be retrieved
	 * @returns The corresponding atomic number
	 */
	getAtomZ(symbol: string): number {

		return this.symbol2an.get(symbol.toLowerCase()) ?? 0;
	}

	// > Access the singleton instance
	/**
	 * Access the singleton instance.
	 *
	 * This is the static method that controls the access to the singleton instance.
	 * This implementation let you subclass the Singleton class while keeping
	 * just one instance of each subclass around.
	 *
	 * @returns The Atom Info object
	 */
    static getInstance(): AtomInfo {

        if(!AtomInfo.instance) {
            AtomInfo.instance = new AtomInfo();
        }

        return AtomInfo.instance;
    }
}

/**
 * Initialize the atom info cache
 */
export const atomInfoInit = (): void => AtomInfo.getInstance().init();

/**
 * Return the atom color
 *
 * @param atomZ - Atomic number for which the atom color should be returned
 * @returns Color as a #RRGGBB string
 */
export const atomColor = (atomZ: number): string => AtomInfo.getInstance().atomData(atomZ).color;

/**
 * Return the atom symbol
 *
 * @param atomZ - Atomic number for which the atom symbol should be returned
 * @returns The atom symbol
 */
export const atomSymbol = (atomZ: number): string => AtomInfo.getInstance().atomData(atomZ).symbol;

/**
 * Convert an atomic symbol into the corresponding atomic number
 *
 * @param symbol - Atomic symbol for which the atomic number should be retrieved
 * @returns The corresponding atomic number
 */
export const symbolToZ = (symbol: string): number => AtomInfo.getInstance().getAtomZ(symbol);

/**
 * Retrieve all data pertaining to the given atomic number
 *
 * @param atomZ - Atom number for which the data should be retrieved
 * @returns All data pertaining to the given atomic number
 */
export const atomData = (atomZ: number): AtomAppearance => AtomInfo.getInstance().atomData(atomZ);
