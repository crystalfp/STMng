/**
 * Compute fingerprints for the accumulated structures.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-09
 */
import {invertBasis} from "../modules/Helpers";
import {nullMethod, perElementRdfHistogram} from "./Methods";
import type {BasisType, FingerprintingMethodName, FingerprintingParameters, PositionType} from "@/types";
import type {FingerprintsAccumulator, StructureReduced} from "./Accumulator";

/** Type of the table of fingerprinting methods */
type FingerprintingMethod = FingerprintingMethodName & {
	method: (structure: StructureReduced,
			 expansion: PositionType,
			 params: FingerprintingParameters) => void;
};

interface FingerprintingComputeResult {
	/** Computed fingerprint length */
	dimension: number;
	/** Error from fingerprinting, if any */
	error?: string;
}

export class Fingerprinting {

	/** Fingerprinting methods list */
	private readonly fpMethods: FingerprintingMethod[] = [
		{label: "Normalized diffraction",				needSizes: true,  method: perElementRdfHistogram},
		{label: "Mendeleev spectra",					needSizes: true,  method: nullMethod},
		{label: "Chemical scale spectra",				needSizes: true,  method: nullMethod},
		{label: "Per element diffraction",				needSizes: true,  method: nullMethod},
		{label: "Distances per atom",					needSizes: false, method: nullMethod},
		{label: "Merged distances",						needSizes: false, method: nullMethod},
		{label: "Re-centered per element diffraction",	needSizes: true,  method: nullMethod},
		{label: "Trimmed per element diffraction",		needSizes: false, method: nullMethod},
	];

	private readonly tryPoints: number[][] = [];

	constructor() {

		// Initialize try points
		this.computeTryPoints(8, 8);
	}

	/**
	 * Return the list of methods names
	 *
	 * @returns The list of fingerprinting methods for the selector on the UI
	 */
	getFingerprintMethodsNames(): FingerprintingMethodName[] {

		const out: FingerprintingMethodName[] = [];
		for(const entry of this.fpMethods) {
			out.push({label: entry.label, needSizes: entry.needSizes});
		}
		return out;
	}

	/**
	 * Compute points on a sphere of radius one
	 *
	 * @param verticalDivisions - Sphere vertical subdivisions
	 * @param horizontalDivisions - Horizontal subdivisions
	 */
	private computeTryPoints(verticalDivisions: number, horizontalDivisions: number): void {

		// Test points on a sphere of radius 1
		this.tryPoints.length = horizontalDivisions*(verticalDivisions-1)+2;

		// Add the North pole
		this.tryPoints[0] = [1, 0, 0];

		// Some constants
		const pivd = Math.PI/verticalDivisions;
		const pihd = Math.PI/horizontalDivisions;

		// Add points along parallel circles
		let j = 1;
		for(let v=1; v < verticalDivisions; ++v) {

			const first = Math.cos(pivd*v);
			for(let h=0; h < horizontalDivisions; ++h) {

				const angle = pihd*h;
				this.tryPoints[j] = [first, Math.cos(angle), Math.sin(angle)];
				++j;
			}
		}

		// Add the South pole
		this.tryPoints[j] = [-1, 0, 0];
	}

	/**
	 * Compute expansions along each base axis
	 *
	 * @param basis - Structure basis
	 * @param expansion - Resulting expansions along each base axis
	 * @param cutoffDistance - The requested cutoff radius
	 * @param peakWidth - Peak width of the smoothing gaussian for the fingerprint histogram
	 */
	private computeExpansion(basis: BasisType, expansion: PositionType,
							 cutoffDistance: number, peakWidth: number): void {

		// Initialize expansion factor
		let ex = 1;
		let ey = 1;
		let ez = 1;

		const basisX = basis[0] + basis[3] + basis[6];
		const basisY = basis[1] + basis[4] + basis[7];
		const basisZ = basis[2] + basis[5] + basis[8];
		const cutoff = cutoffDistance + 4 * peakWidth;

		const inverse = invertBasis(basis);

		for(const point of this.tryPoints) {

			// Enlarge to account for truncation
			const x = basisX + point[0]*cutoff;
			const y = basisY + point[1]*cutoff;
			const z = basisZ + point[2]*cutoff;

			// The end point in fractional coordinates
			const xf = x*inverse[0]+y*inverse[3]+z*inverse[6];
			const yf = x*inverse[1]+y*inverse[4]+z*inverse[7];
			const zf = x*inverse[2]+y*inverse[5]+z*inverse[8];

			if(xf < 0) {
				const n = Math.ceil(-xf);
				if(n > ex) ex = n;
			}
			else if(xf > 2) {
				const n = Math.ceil(xf) - 1;
				if(n > ex) ex = n;
			}
			if(yf < 0) {
				const n = Math.ceil(-yf);
				if(n > ey) ey = n;
			}
			else if(yf > 2) {
				const n = Math.ceil(yf) - 1;
				if(n > ey) ey = n;
			}
			if(zf < 0) {
				const n = Math.ceil(-zf);
				if(n > ez) ez = n;
			}
			else if(zf > 2) {
				const n = Math.ceil(zf) - 1;
				if(n > ez) ez = n;
			}
		}

		// Return results
		expansion[0] = ex;
		expansion[1] = ey;
		expansion[2] = ez;
	};

	/**
	 * Compute fingerprints
	 *
	 * @param accumulator - The accumulated structures
	 * @param params - Set of parameters needed for the computation
	 * @returns Dimensionality of the fingerprints, zero on error
	 */
	compute(accumulator: FingerprintsAccumulator,
			params: FingerprintingParameters): FingerprintingComputeResult {

		// No structures selected, no computation
		const countStructures = accumulator.selectedSize();
		if(countStructures === 0) return {dimension: 0, error: "No structures selected"};

		// Get and verify parameters
		const {method, areNanoclusters, cutoffDistance, binSize, peakWidth} = params;
		if(method === undefined || method < 0 || method >= this.fpMethods.length) {
			return {dimension: 0, error: "Invalid fingerprinting method"};
		}
		if(cutoffDistance <= 0 || binSize <= 0 || peakWidth <= 0) {
			return {dimension: 0, error: "Invalid fingerprinting parameters"};
		}

		let fingerprintSize = 0;
		for(const structure of accumulator.iterateSelectedStructures()) {

			const {basis, fingerprint} = structure;

			// Compute the infinite slab for crystal structures
			const expansion: PositionType = [0, 0, 0];
			if(!areNanoclusters) {

				this.computeExpansion(basis, expansion, cutoffDistance, peakWidth);
			}

			// Compute fingerprint
			this.fpMethods[method].method(structure, expansion, params);

			// Get fingerprint size
			if(fingerprintSize === 0) fingerprintSize = fingerprint.length;
			if(fingerprintSize !== fingerprint.length) {
				return {dimension: 0, error: "Fingerprinting dimension has changed"};
			}
		}

		return {dimension: fingerprintSize};
	};
}
