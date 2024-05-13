/**
 * Types specific for the main process.
 *
 * @packageDocumentation
 */
import type {Structure, BasisType, MainResponse, Look} from "../../types";

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

interface ReaderOptions {
	atomsTypes?: string[];
	useBohr?: boolean;
}

/** Interface exposed by all format readers */
export interface ReaderImplementation {
	readStructure: (filename: string, options?: ReaderOptions) => Promise<Structure[]>;
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

/** Type of the parameters passed to ComputeSymmetries compute module */
export interface ComputeSymmetriesParams {

	// Structure
	basis: BasisType;
	spaceGroup: string;
	atomsZ: number[];
	fractionalCoordinates: number[];

	// Operations
	applyInputSymmetries: boolean;
	enableFindSymmetries: boolean;
	standardizeCell: boolean;

	// Tolerances
	symprecStandardize: number;
	symprecDataset: number;
}

export interface ComputeSymmetriesOutput {

	basis: BasisType;
	spaceGroup: string;
	atomsZ: number[];
	labels: string[];
	fractionalCoordinates: number[];
	noCellChanges: boolean;
	look: Look;
}

/** Interface exposed by all format writers */
export interface WriterImplementation {
	writeStructure: (filename: string, structures: Structure[]) => MainResponse;
}
