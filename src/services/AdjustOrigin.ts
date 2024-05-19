/**
 * Translate the cell origin with or without changing the cell size.
 *
 * @packageDocumentation
 */
import log from "electron-log";
import type {BasisType, PositionType, Structure, Atom} from "@/types";

/** Tolerance to check fractal coordinate on the cell border */
const FOLD_TOL = 1e-5;

/**
 * Fold fractal coordinate to inside the unit cell
 *
 * @param fc - One fractal coordinate that can go outside the unit cell
 * @returns The fractal coordinate folded to the unit cell
 */
const foldIntoUnitCell = (fc: number): number => {

	if(fc > 1) return fc - 1;
	if(fc < FOLD_TOL && fc > -FOLD_TOL) return 0;

	if(fc < 0) return fc + 1;
	if(fc < (1+FOLD_TOL) && fc > (1-FOLD_TOL)) return 0;

	return fc;
};

/**
 * Adjust the cell origin
 *
 * @param structure - The structure to modify
 * @param pa - Fraction of the a basis vector to move the origin
 * @param pb - Fraction of the b basis vector to move the origin
 * @param pc - Fraction of the c basis vector to move the origin
 * @param shrink - True if the other side of the cell should not move
 * @returns The updated structure
 */
export const adjustOrigin = (structure: Structure,
							 pa: number, pb: number, pc: number,
							 shrink: boolean): Structure | undefined => {

	if(!structure?.crystal) return undefined;

	// No adjustment, do nothing
	if(pa === 0 && pb === 0 && pc === 0) return structure;

	const {crystal, atoms, look} = structure;
	const {basis, origin, spaceGroup} = crystal;

	const updatedOrigin: PositionType = [
		origin[0] + pa*basis[0]+pb*basis[3]+pc*basis[6],
		origin[1] + pa*basis[1]+pb*basis[4]+pc*basis[7],
		origin[2] + pa*basis[2]+pb*basis[5]+pc*basis[8],
	];

	const updatedBasis: BasisType =
		shrink ?
		[
			basis[0]*(1-pa), basis[1]*(1-pa), basis[2]*(1-pa),
			basis[3]*(1-pb), basis[4]*(1-pb), basis[5]*(1-pb),
			basis[6]*(1-pc), basis[7]*(1-pc), basis[8]*(1-pc),
		] :
		[
			basis[0], basis[1], basis[2],
			basis[3], basis[4], basis[5],
			basis[6], basis[7], basis[8],
		];

	// Now invert the updated basis matrix
	const b = updatedBasis;

	// Compute the determinant of the matrix
	const det = b[0] * (b[4] * b[8] - b[5] * b[7]) -
				b[1] * (b[3] * b[8] - b[5] * b[6]) +
				b[2] * (b[3] * b[7] - b[4] * b[6]);

	// Check if the determinant is zero, which means the matrix is not invertible
	if(det === 0) {
		log.error("Basis matrix is not invertible");
		return structure;
	}

	// Compute the inverse basis matrix
	const invDet = 1 / det;
	const inverse = [
		(b[4] * b[8] - b[5] * b[7]) * invDet,
		(b[2] * b[7] - b[1] * b[8]) * invDet,
		(b[1] * b[5] - b[2] * b[4]) * invDet,
		(b[5] * b[6] - b[3] * b[8]) * invDet,
		(b[0] * b[8] - b[2] * b[6]) * invDet,
		(b[2] * b[3] - b[0] * b[5]) * invDet,
		(b[3] * b[7] - b[4] * b[6]) * invDet,
		(b[1] * b[6] - b[0] * b[7]) * invDet,
		(b[0] * b[4] - b[1] * b[3]) * invDet
	];

	// For each atom fold its position to inside the unit cell
	const updatedAtoms: Atom[] = [];
	for(const atom of atoms) {

		const fc = toFractalCoordinates(inverse, updatedOrigin, atom.position);
		fc[0] = foldIntoUnitCell(fc[0]);
		fc[1] = foldIntoUnitCell(fc[1]);
		fc[2] = foldIntoUnitCell(fc[2]);

		updatedAtoms.push({
			position: toCartesianCoordinates(updatedBasis, updatedOrigin, fc),
			atomZ: atom.atomZ,
			label: atom.label
		});
	}

	// Rebuild the structure
	const out: Structure = {
		crystal: {
			basis: updatedBasis,
			origin: updatedOrigin,
			spaceGroup
		},
		atoms: updatedAtoms,
		bonds: [],
		look,
		volume: []
	};

	return out;
};

/**
 * Convert cartesian to fractal coordinate
 *
 * @param inverse - Inverse of the basis matrix
 * @param origin - The cell origin
 * @param position - Cartesian position to be converted to fractal coordinates
 * @returns Fractal coordinates
 */
const toFractalCoordinates = (inverse: number[], origin: PositionType, position: PositionType): PositionType => {

	const cx = position[0] - origin[0];
	const cy = position[1] - origin[1];
	const cz = position[2] - origin[2];

	return [
		cx*inverse[0] + cy*inverse[3] + cz*inverse[6],
		cx*inverse[1] + cy*inverse[4] + cz*inverse[7],
		cx*inverse[2] + cy*inverse[5] + cz*inverse[8]
	];
};

/**
 * Convert fractal to cartesian coordinates
 *
 * @param basis - Basis matrix
 * @param origin - Cell origin
 * @param fc - Fractal coordinates
 * @returns Corresponding cartesian coordinates
 */
const toCartesianCoordinates = (basis: BasisType, origin: PositionType, fc: PositionType): PositionType =>
[
	fc[0]*basis[0] + fc[1]*basis[3] + fc[2]*basis[6] + origin[0],
	fc[0]*basis[1] + fc[1]*basis[4] + fc[2]*basis[7] + origin[1],
	fc[0]*basis[2] + fc[1]*basis[5] + fc[2]*basis[8] + origin[2],
];
