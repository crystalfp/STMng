/**
 * Apply symmetries to structure.
 *
 * @packageDocumentation
 */
/* eslint-disable eslint-comments/disable-enable-pair, no-bitwise */
import {sb, type UiParams} from "@/services/Switchboard";
import type {Structure} from "@/types";
import {computeBonds} from "@/services/ComputeBonds";
import {computeSymmetries} from "@/services/RoutesClient";
import {resetErrorNotification, showErrorNotification} from "@/services/ErrorNotification";

// > Kind of directions for filling unit cell
const X_MIN = 0x010;
const Y_MIN = 0x020;
const Z_MIN = 0x040;
const X_MAX = 0x080;
const Y_MAX = 0x100;
const Z_MAX = 0x200;
const X_ANY = 0x001;
const Y_ANY = 0x002;
const Z_ANY = 0x004;

export class ApplySymmetries {

	private fillUnitCell = true;
	private enableSymmetryComputation = true;
	private structure: Structure | undefined;
	private fractionalCoords: number[] = [];
	private readonly atomIdx: number[] = [];

	/**
	 * Create the node
	 *
	 * @param id - ID of the Apply Symmetries node
	 */
	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {

    		this.fillUnitCell  = params.fillUnitCell as boolean ?? true;
    		this.enableSymmetryComputation = params.enableSymmetryComputation as boolean ?? true;

			this.computeSymmetries(this.enableSymmetryComputation, this.fillUnitCell);
		});

		sb.getData(this.id, (data: unknown) => {

			this.structure = data as Structure;
			const {crystal} = this.structure;

			sb.setUiParams(this.id, {symmetryGroup: crystal?.spaceGroup ?? ""});

			this.computeSymmetries(this.enableSymmetryComputation, this.fillUnitCell);
		});
	}

	/**
	 * Compute symmetries and eventually fill the unit cell
	 *
	 * @param enabled - Enable symmetries computation
	 * @param fill - Fill the unit cell
	 */
	private computeSymmetries(enabled: boolean, fill: boolean): void {

		// Reset error notification
		resetErrorNotification("applySymmetries");

		// If no input structure, output an empty structure
		if(!this.structure?.atoms || this.structure.atoms?.length === 0) {

			this.outputEmptyStructure();
			return;
		}

		// If has no unit cell, do nothing
		if(!this.structure.crystal?.basis?.some((value) => value !== 0)) {

			sb.setData(this.id, this.structure);
			return;
		}

		// Copy structure to output if no symmetry to apply
		if(!enabled || this.hasNoSymmetry(this.structure.crystal.spaceGroup)) {

			if(fill) {
				this.computeFractionalCoordinates();
				this.fillCell();
				sb.setData(this.id, this.clearStructure());
			}
			else sb.setData(this.id, this.structure);
			return;
		}

		// Compute symmetries
		this.computeFractionalCoordinates();
		computeSymmetries(this.structure.crystal.spaceGroup, this.fractionalCoords)
			.then((response) => {

				if(response.error) throw Error(`Error computing symmetries: ${response.error}`);

				const payload = JSON.parse(response.payload) as {coords: number[]; error: string};
				this.fractionalCoords = payload.coords;
				if(payload.error !== "") throw Error(payload.error);

				const natoms = this.structure!.atoms.length;
				const repetitions = this.fractionalCoords.length / (natoms*3);

				this.atomIdx.length = natoms*repetitions;
				for(let i=0; i < repetitions; ++i) {
					for(let j=0; j < natoms; ++j) this.atomIdx[i*natoms+j] = j;
				}

				// Clear structure and output it
				if(fill) this.fillCell();
				sb.setData(this.id, this.clearStructure());
			})
			.catch((error: Error) => {
				showErrorNotification(error.message, "applySymmetries");

				sb.setData(this.id, this.structure);
			});
	}

	/**
	 * Compute the structure atoms fractional coordinates
	 */
	private computeFractionalCoordinates(): void {

		// Get the basis
		const b = this.structure!.crystal.basis;

		// Compute the determinant of the matrix
		const det = b[0] * (b[4] * b[8] - b[5] * b[7]) -
					b[1] * (b[3] * b[8] - b[5] * b[6]) +
					b[2] * (b[3] * b[7] - b[4] * b[6]);

		// Check if the determinant is zero, which means the matrix is not invertible
		if(det === 0) {
			showErrorNotification("Basis matrix is not invertible", "applySymmetries");
			return;
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

		// For each atom compute the fractional coordinates
		const natoms = this.structure!.atoms.length;
		this.fractionalCoords.length = natoms * 3;
		this.atomIdx.length = natoms;

		const {origin} = this.structure!.crystal;

		for(let i=0; i < natoms; ++i) {

			const {position} = this.structure!.atoms[i];
			const cx = position[0] - origin[0];
			const cy = position[1] - origin[1];
			const cz = position[2] - origin[2];

			this.fractionalCoords[i*3+0] = cx*inverse[0] + cy*inverse[3] + cz*inverse[6];
			this.fractionalCoords[i*3+1] = cx*inverse[1] + cy*inverse[4] + cz*inverse[7];
			this.fractionalCoords[i*3+2] = cx*inverse[2] + cy*inverse[5] + cz*inverse[8];

			this.atomIdx[i] = i;
		}
	}

	/**
	 * Check if the structure has symmetry
	 *
	 * @param spaceGroup - Space Group from the structure
	 * @returns True if the structure has no symmetry
	 */
	private hasNoSymmetry(spaceGroup: string): boolean {

		const sg = spaceGroup.trim();

		return sg === "" || sg === "P 1" || sg === "P1";
	}

	/**
	 * Output an empty structure
	 */
	private outputEmptyStructure(): void {

		sb.setData(this.id,
				   {
						crystal: {
							basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
							origin: [0, 0, 0],
							spaceGroup: ""
						},
						atoms: [],
						bonds: [],
						look: {}
				   }
		);
	}

	/**
	 * Fill the unit cell: atoms on the border of the unit cell will be copied to the other side
	 */
	private fillCell(): void {

		const tol = 1e-5;

		const natoms = this.structure!.atoms.length;
		const direction = Array(natoms) as number[];
		for(let i=0; i < natoms; ++i) {

			const xf = this.fractionalCoords[i*3+0];
			const yf = this.fractionalCoords[i*3+1];
			const zf = this.fractionalCoords[i*3+2];

			// Mark atoms exactly on the border
			if(xf < tol && xf > -tol)          	direction[i] = X_MIN|X_ANY;
			else if(xf > 1-tol && xf < 1+tol)	direction[i] = X_MAX|X_ANY;
			else                  				direction[i] = 0;
			if(yf < tol && yf > -tol)			direction[i] |= Y_MIN|Y_ANY;
			else if(yf > 1-tol && yf < 1+tol)	direction[i] |= Y_MAX|Y_ANY;
			if(zf < tol && zf > -tol)			direction[i] |= Z_MIN|Z_ANY;
			else if(zf > 1-tol && zf < 1+tol)	direction[i] |= Z_MAX|Z_ANY;
		}

		// No atoms to add. Do nothing
		if(!direction.some((value) => value !== 0)) return;

		// Replicate the original atoms
		const fc = this.fractionalCoords;
		const idx = this.atomIdx;
		for(let i=0; i < natoms; ++i) {

			const dir = direction[i];

			if(dir === 0) continue;

			switch(dir & (X_ANY|Y_ANY|Z_ANY)) {

			case X_ANY:
				fc.push(dir & X_MIN ? 1 : 0, fc[3*i+1], fc[3*i+2]);
				idx.push(i);
				break;

			case Y_ANY:
				fc.push(fc[3*i+0], dir & Y_MIN ? 1 : 0, fc[3*i+2]);
				idx.push(i);
				break;

			case Z_ANY:
				fc.push(fc[3*i+0], fc[3*i+1], dir & Z_MIN ? 1 : 0);
				idx.push(i);
				break;

			case X_ANY|Y_ANY:
				if((dir & (X_MIN|Y_MIN)) !== (X_MIN|Y_MIN)) {
					fc.push(0, 0, fc[3*i+2]);
					idx.push(i);
				}
				if((dir & (X_MAX|Y_MIN)) !== (X_MAX|Y_MIN)) {
					fc.push(1, 0, fc[3*i+2]);
					idx.push(i);
				}
				if((dir & (X_MIN|Y_MAX)) !== (X_MIN|Y_MAX)) {
					fc.push(0, 1, fc[3*i+2]);
					idx.push(i);
				}
				if((dir & (X_MAX|Y_MAX)) !== (X_MAX|Y_MAX)) {
					fc.push(1, 1, fc[3*i+2]);
					idx.push(i);
				}
				break;

			case X_ANY|Z_ANY:
				if((dir & (X_MIN|Z_MIN)) !== (X_MIN|Z_MIN)) {
					fc.push(0, fc[3*i+1], 0);
					idx.push(i);
				}
				if((dir & (X_MAX|Z_MIN)) !== (X_MAX|Z_MIN)) {
					fc.push(1, fc[3*i+1], 0);
					idx.push(i);
				}
				if((dir & (X_MIN|Z_MAX)) !== (X_MIN|Z_MAX)) {
					fc.push(0, fc[3*i+1], 1);
					idx.push(i);
				}
				if((dir & (X_MAX|Z_MAX)) !== (X_MAX|Z_MAX)) {
					fc.push(1, fc[3*i+1], 1);
					idx.push(i);
				}
				break;

			case Y_ANY|Z_ANY:
				if((dir & (Y_MIN|Z_MIN)) !== (Y_MIN|Z_MIN)) {
					fc.push(fc[3*i+0], 0, 0);
					idx.push(i);
				}
				if((dir & (Y_MAX|Z_MIN)) !== (Y_MAX|Z_MIN)) {
					fc.push(fc[3*i+0], 1, 0);
					idx.push(i);
				}
				if((dir & (Y_MIN|Z_MAX)) !== (Y_MIN|Z_MAX)) {
					fc.push(fc[3*i+0], 0, 1);
					idx.push(i);
				}
				if((dir & (Y_MAX|Z_MAX)) !== (Y_MAX|Z_MAX)) {
					fc.push(fc[3*i+0], 1, 1);
					idx.push(i);
				}
				break;

			case X_ANY|Y_ANY|Z_ANY:
				if((dir & (X_MIN|Y_MIN|Z_MIN)) !== (X_MIN|Y_MIN|Z_MIN)) {
					fc.push(0, 0, 0);
					idx.push(i);
				}
				if((dir & (X_MAX|Y_MIN|Z_MIN)) !== (X_MAX|Y_MIN|Z_MIN)) {
					fc.push(1, 0, 0);
					idx.push(i);
				}
				if((dir & (X_MIN|Y_MAX|Z_MIN)) !== (X_MIN|Y_MAX|Z_MIN)) {
					fc.push(0, 1, 0);
					idx.push(i);
				}
				if((dir & (X_MAX|Y_MAX|Z_MIN)) !== (X_MAX|Y_MAX|Z_MIN)) {
					fc.push(1, 1, 0);
					idx.push(i);
				}
				if((dir & (X_MIN|Y_MIN|Z_MAX)) !== (X_MIN|Y_MIN|Z_MAX)) {
					fc.push(0, 0, 1);
					idx.push(i);
				}
				if((dir & (X_MAX|Y_MIN|Z_MAX)) !== (X_MAX|Y_MIN|Z_MAX)) {
					fc.push(1, 0, 1);
					idx.push(i);
				}
				if((dir & (X_MIN|Y_MAX|Z_MAX)) !== (X_MIN|Y_MAX|Z_MAX)) {
					fc.push(0, 1, 1);
					idx.push(i);
				}
				if((dir & (X_MAX|Y_MAX|Z_MAX)) !== (X_MAX|Y_MAX|Z_MAX)) {
					fc.push(1, 1, 1);
					idx.push(i);
				}
				break;
			}
		}
	}

	/**
	 * Remove duplicated atoms and recompute bonds
	 */
	private clearStructure(): Structure {

		// Remove duplicated
		const tol = 1e-3;
		const fc = this.fractionalCoords;
		const nfatoms = fc.length / 3;
		const duplicated = Array(nfatoms) as boolean[];
		for(let i=0; i < nfatoms; ++i) duplicated[i] = false;
		for(let i=0; i < nfatoms-1; ++i) {
			if(duplicated[i]) continue;
			for(let j=i+1; j < nfatoms; ++j) {
				if(duplicated[j]) continue;
				const fdx = fc[3*i+0] - fc[3*j+0];
				if(fdx < tol && fdx > -tol) {
					const fdy = fc[3*i+1] - fc[3*j+1];
					if(fdy < tol && fdy > -tol) {
						const fdz = fc[3*i+2] - fc[3*j+2];
						if(fdz < tol && fdz > -tol) {
							duplicated[j] = true;
						}
					}
				}
			}
		}

		// Transform to cartesian coordinates
		const out: Structure = {
			crystal: this.structure!.crystal,
			atoms: [],
			bonds: [],
			look: this.structure!.look
		};
		const {basis, origin} = this.structure!.crystal;
		for(let i=0; i < nfatoms; ++i) {

			if(duplicated[i]) continue;

			const fx = this.fractionalCoords[i*3+0];
			const fy = this.fractionalCoords[i*3+1];
			const fz = this.fractionalCoords[i*3+2];

			out.atoms.push({
				atomZ: this.structure!.atoms[this.atomIdx[i]].atomZ,
				label: this.structure!.atoms[this.atomIdx[i]].label,
				position: [
					fx*basis[0] + fy*basis[3] + fz*basis[6] + origin[0],
					fx*basis[1] + fy*basis[4] + fz*basis[7] + origin[1],
					fx*basis[2] + fy*basis[5] + fz*basis[8] + origin[2],
				]
			});
		}

		// Recompute bonds
		const rCov: number[] = [];
		for(const atom of out.atoms) {
			const {atomZ} = atom;
			rCov.push(out.look[atomZ].rCov);
		}
		out.bonds = computeBonds(out.atoms, rCov);

		// Output structure from the node
		return out;
	}

	/**
	 * Save the node status
	 *
	 * @returns Entry as JSON of the node status for saving
	 */
	saveStatus(): string {

		const statusToSave = {
			fillUnitCell: this.fillUnitCell,
			enableSymmetryComputation: this.enableSymmetryComputation,
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
