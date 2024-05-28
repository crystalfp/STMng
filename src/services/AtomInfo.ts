/**
 * Cache the atom data on the client.
 *
 * @packageDocumentation
 */
import {getAtomData} from "@/services/RoutesClient";
import type {AtomAppearance} from "@/types";
import log from "electron-log";

class AtomInfo {

    private static instance: AtomInfo;
	private data: AtomAppearance[] = [];

	init(): void {

		getAtomData()
			.then((dataRaw) => {
				this.data = JSON.parse(dataRaw) as AtomAppearance[];
			})
			.catch((error: Error) => {
				log.error("Cannot initialize atom's data. Error:", error.message);
			});
	}

	atomData(atomZ: number): AtomAppearance {
		return this.data[atomZ];
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

// > Access to the atom info
/** Access to the atom info */
export const ai = AtomInfo.getInstance();

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
