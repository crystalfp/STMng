/**
 * Types pertaining to the main process.
 *
 * @packageDocumentation
 *
 * @author Mario Valle {@link "mvalle@ikmail.com"}
 */
import type {Structure, BasisType, MainResponse} from "../../types";

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

/** Options object for the readers */
interface ReaderOptions {
	/** Optional list of atoms types from the user */
	atomsTypes?: string[];
	/** Use Bohr measurement units instead of Angstroms */
	useBohr?: boolean;
}

/** Interface exposed by all format readers */
export interface ReaderImplementation {
	/**
	 * Read structure file
	 *
	 * @param filename - Structure file to be read
	 * @param options - Options for the reader
	 * @returns - List of structures read
	 */
	readStructure: (filename: string, options?: ReaderOptions) => Promise<Structure[]>;
}

/** Type of the parameters passed to ComputeSymmetries native compute module */
export interface ComputeSymmetriesParams {

	// Structure
	/** Current structure basis vectors */
	basis: BasisType;
	/** Current structure symmetry */
	spaceGroup: string;
	/** Atoms' atomic numbers */
	atomsZ: number[];
	/** Atoms' fractional coordinates */
	fractionalCoordinates: number[];

	// Operations
	/** Apply the input symmetries to the structure */
	applyInputSymmetries: boolean;
	/** Enable the find symmetries and standardize cell steps */
	enableFindSymmetries: boolean;
	/** Run the standardize cell step */
	standardizeCell: boolean;
	/** Only run the standardize cell step */
	standardizeOnly: boolean;

	// Tolerances
	/** Tolerance for the cell standardize step */
	symprecStandardize: number;
	/** Tolerance for the find symmetries step */
	symprecDataset: number;
}

/** Output from the native module that computes and find symmetries */
export interface ComputeSymmetriesOutput {

	/** Computed basis vectors */
	basis: BasisType;
	/** Computed symmetry */
	spaceGroup: string;
	/** Atoms' atomic numbers */
	atomsZ: number[];
	/** Atoms' computed labels */
	labels: string[];
	/** Computed atoms' fractional coordinates */
	fractionalCoordinates: number[];
	/** True if the cell has been changed */
	noCellChanges: boolean;
	/** Process errors if not the empty string */
	status: string;
}

/** Interface exposed by all format writers */
export interface WriterImplementation {
	/**
	 * Write structure file
	 *
	 * @param filename - Output filename
	 * @param structures - List of structures to be written
	 * @returns Standard response object
	 */
	writeStructure: (filename: string, structures: Structure[]) => MainResponse;
}
