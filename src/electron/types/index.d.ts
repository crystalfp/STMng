/**
 * Types specific for the main process.
 *
 * @packageDocumentation
 */
import type {Structure, BasisType} from "../../types";

/** Parameters for the window creation */
export interface WindowsParams {
    /** The router path for the created window (should also be in src/router/index.ts) */
    routerPath: string;
    /** Width of the window */
    width: number;
    /** Height of the window */
    height: number;
    /** Title of the window */
    title: string;
    /** Data to be passed to the window when it is ready */
    data?: string;
}

// export type Constructable<T> = new() => T;

export interface ReaderImplementation {
	readStructure: (filename: string, atomsTypes?: string[]) => Promise<Structure[]>;
}

/** Type of the parameters passed to FindSymmetries compute module */
export interface FindSymmetriesParams {
	ignoreSymmetries: boolean;
	basis: BasisType;
	spaceGroup: string;
	atomsZ: number[];
	fractionalCoordinates: number[];
	tolS: number;
	tolT: number;
	tolG: number;
}
