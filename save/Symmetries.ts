/**
 * Find and apply symmetries to structure.
 *
 * @packageDocumentation
 */
/* eslint-disable eslint-comments/disable-enable-pair, no-bitwise */
import {sb, type UiParams} from "@/services/Switchboard";
import {computeSymmetries, findSymmetries, createWindow, sendToWindow} from "@/services/RoutesClient";
import {resetErrorNotification, showErrorNotification} from "@/services/ErrorNotification";
import type {Structure} from "@/types";
import type {FindSymmetriesParams} from "@/electron/types";

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

export class Symmetries {

	private inputStructure: Structure | undefined;

	private enableFindSymmetries = true;
	private ignoreInputSymmetries = false;
	private tolS = .25;
	private tolT = .25;
	private tolG = .10;

	private enableApplySymmetries = true;
	private fillUnitCell = true;

	private showSymmetriesDialog = false;

	private fractionalCoords: number[] = [];
	private readonly atomIdx: number[] = [];

	// > Create the node
	/**
	 * Create the node
	 *
	 * @param id - ID of the Symmetries node
	 */
	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {

    		this.enableFindSymmetries = params.enableFindSymmetries as boolean ?? true;
    		this.ignoreInputSymmetries = params.ignoreInputSymmetries as boolean ?? false;
    		this.tolS = params.tolS as number ?? 0.25;
    		this.tolT = params.tolT as number ?? 0.25;
    		this.tolG = params.tolG as number ?? 0.10;

    		this.enableApplySymmetries = params.enableApplySymmetries as boolean ?? true;
    		this.fillUnitCell  = params.fillUnitCell as boolean ?? true;

			this.showSymmetriesDialog = params.showSymmetriesDialog as boolean ?? false;

			if(this.showSymmetriesDialog) {
				sb.setUiParams(this.id, {showSymmetriesDialog: false});
				this.openSymmetriesDialog();
			}

			if(this.inputStructure?.crystal) this.getSymmetries();
		});

		sb.getData(this.id, (data: unknown) => {

			this.inputStructure = data as Structure;
			if(!this.inputStructure) return;
			const {crystal, volume, atoms} = this.inputStructure;
			if(crystal === undefined) return;

			// If space group contains symmetry cards instead of symbol, ignore it
			if(!this.ignoreInputSymmetries && /[(\nxyz]/i.test(crystal.spaceGroup)) {
				this.ignoreInputSymmetries = true;
			}

			if(volume.length > 0 || atoms.length > 500) {
				this.enableFindSymmetries = false;
			}

			sb.setUiParams(this.id, {
				ignoreInputSymmetries: this.ignoreInputSymmetries,
				enableFindSymmetries: this.enableFindSymmetries
			});

			this.getSymmetries();
		});
	}

	// > Execute find and apply symmetries as requested
	/**
	 * Execute find and apply symmetries as requested
	 */
	private getSymmetries(): void {

		// Reset error notification
		resetErrorNotification("symmetries");

		// If input structure has no unit cell, disable find symmetries
		if(this.inputStructure!.crystal.basis.every((value) => value === 0)) {

			sb.setData(this.id, this.inputStructure!);
			sb.setUiParams(this.id, {
				finalSymmetry: this.inputStructure?.crystal?.spaceGroup ?? "",
				enableFindSymmetries: false,
				enableApplySymmetries: false
			});
			this.updateSymmetriesDialog();
			return;
		}

		if(this.enableFindSymmetries) {
			this.findSymmetries(this.inputStructure!)
				.then((structure) => {
					sb.setUiParams(this.id, {
						finalSymmetry: structure.crystal.spaceGroup
					});
					this.applySymmetries(structure);
					this.updateSymmetriesDialog(structure.crystal.spaceGroup);
				})
				.catch((error: Error) => {
					showErrorNotification(error.message, "symmetries");
					sb.setUiParams(this.id, {
						finalSymmetry: this.inputStructure?.crystal?.spaceGroup ?? ""
					});
					this.applySymmetries(this.inputStructure);
					this.updateSymmetriesDialog();
				});
		}
		else {
			sb.setUiParams(this.id, {
				finalSymmetry: this.inputStructure?.crystal?.spaceGroup ?? ""
			});
			this.applySymmetries(this.inputStructure);
			this.updateSymmetriesDialog();
		}
	}

	// > Find structure symmetries and return the updated structure
	/**
	 * Find structure symmetries and return the updated structure
	 *
	 * @param structure - The structure for which the symmetries should be found
	 * @returns The structure with the found symmetries
	 */
	private async findSymmetries(structure: Structure): Promise<Structure> {

		// No atoms, do nothing
		if(!structure?.atoms) {
			return {
				crystal: {
					basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
					origin: [0, 0, 0],
					spaceGroup: ""
				},
				atoms: [],
				bonds: [],
				look: {},
				volume: []
			};
		}
		if(structure.atoms.length === 0) return structure;

		// Extract data for the computational part
		const atomsZ: number[] = [];
		for(const atom of structure.atoms) atomsZ.push(atom.atomZ);

		// Send params to the computational part
		const computeParams: FindSymmetriesParams = {
			ignoreSymmetries: this.ignoreInputSymmetries,
			basis: structure.crystal.basis,
			spaceGroup: structure.crystal.spaceGroup,
			atomsZ,
			fractionalCoordinates: this.computeFractionalCoordinates(structure),
			tolS: this.tolS,
			tolT: this.tolT,
			tolG: this.tolG,
		};

		// Find symmetries in the main process
		const sts = await findSymmetries(computeParams);
		if(sts.error) throw Error(sts.error);
		return JSON.parse(sts.payload) as Structure;
	}

	/**
	 * Apply symmetries and eventually fill the unit cell
	 *
	 * @param structure - The structure to which the symmetries should be applied
	 */
	private applySymmetries(structure: Structure | undefined): void {

		// If no input structure, output an empty structure
		if(!structure?.atoms || structure.atoms?.length === 0) {

			this.outputEmptyStructure();
			return;
		}

		// If has no unit cell, do nothing
		if(structure.crystal?.basis === undefined || structure.crystal.basis.every((value) => value === 0)) {

			sb.setData(this.id, structure);
			return;
		}

		// Copy structure to output if no symmetries to apply
		if(!this.enableApplySymmetries || this.hasNoSymmetry(structure.crystal.spaceGroup)) {

			if(this.fillUnitCell) {
				this.fractionalCoords = this.computeFractionalCoordinates(structure);
				this.fillCell();
				sb.setData(this.id, this.clearStructure(structure));
			}
			else sb.setData(this.id, structure);
			return;
		}

		// Compute symmetries
		this.fractionalCoords = this.computeFractionalCoordinates(structure);
		computeSymmetries(structure.crystal.spaceGroup, this.fractionalCoords)
			.then((response) => {

				if(response.error) throw Error(`Error computing symmetries: ${response.error}`);

				const payload = JSON.parse(response.payload) as {coords: number[]; error: string};
				this.fractionalCoords = payload.coords;
				if(payload.error !== "") throw Error(payload.error);

				const natoms = structure.atoms.length;
				const repetitions = this.fractionalCoords.length / (natoms*3);

				this.atomIdx.length = natoms*repetitions;
				for(let i=0; i < repetitions; ++i) {
					for(let j=0; j < natoms; ++j) this.atomIdx[i*natoms+j] = j;
				}

				// Clear structure and output it
				if(this.fillUnitCell) this.fillCell();
				sb.setData(this.id, this.clearStructure(structure));
			})
			.catch((error: Error) => {
				showErrorNotification(error.message, "symmetries");

				sb.setData(this.id, structure);
			});
	}

	// > Compute the atoms' fractional coordinates
	/**
	 * Compute the structure atoms' fractional coordinates
	 */
	private computeFractionalCoordinates(structure: Structure): number[] {

		// Get the basis
		const b = structure.crystal.basis;

		// Compute the determinant of the matrix
		const det = b[0] * (b[4] * b[8] - b[5] * b[7]) -
					b[1] * (b[3] * b[8] - b[5] * b[6]) +
					b[2] * (b[3] * b[7] - b[4] * b[6]);

		// Check if the determinant is zero, which means the matrix is not invertible
		if(det === 0) {
			showErrorNotification("Basis matrix is not invertible", "symmetries");
			return [];
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
		const natoms = structure.atoms.length;
		const fractionalCoords = Array(natoms*3).fill(0) as number[];

		this.atomIdx.length = natoms;

		const {origin} = structure.crystal;

		for(let i=0; i < natoms; ++i) {

			const {position} = structure.atoms[i];
			const cx = position[0] - origin[0];
			const cy = position[1] - origin[1];
			const cz = position[2] - origin[2];

			fractionalCoords[i*3]   = cx*inverse[0] + cy*inverse[3] + cz*inverse[6];
			fractionalCoords[i*3+1] = cx*inverse[1] + cy*inverse[4] + cz*inverse[7];
			fractionalCoords[i*3+2] = cx*inverse[2] + cy*inverse[5] + cz*inverse[8];

			this.atomIdx[i] = i;
		}

		return fractionalCoords;
	}

	// > Check if the structure has no symmetries
	/**
	 * Check if the structure has no symmetries
	 *
	 * @param spaceGroup - Space group from the structure
	 * @returns True if the structure has no symmetries
	 */
	private hasNoSymmetry(spaceGroup: string): boolean {

		const sg = spaceGroup.trim();

		return sg === "" || sg === "P 1" || sg === "P1";
	}

	// > Output an empty structure
	/**
	 * Output an empty structure
	 */
	private outputEmptyStructure(): void {

		sb.setData(this.id, {
			crystal: {
				basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
				origin: [0, 0, 0],
				spaceGroup: ""
			},
			atoms: [],
			bonds: [],
			look: {},
			volume: []
		});
	}

	// > Fill the unit cell
	/**
	 * Fill the unit cell: atoms on the border of the unit cell will be copied to the other side
	 */
	private fillCell(): void {

		const tol = 1e-3;

		const natoms = this.fractionalCoords.length/3;
		const direction = Array(natoms).fill(0) as number[];
		for(let i=0; i < natoms; ++i) {

			const xf = this.fractionalCoords[i*3];
			const yf = this.fractionalCoords[i*3+1];
			const zf = this.fractionalCoords[i*3+2];

			// Mark atoms exactly on the border
			if(xf < tol && xf > -tol)          	direction[i]  = X_MIN|X_ANY;
			else if(xf > 1-tol && xf < 1+tol)	direction[i]  = X_MAX|X_ANY;
			if(yf < tol && yf > -tol)			direction[i] |= Y_MIN|Y_ANY;
			else if(yf > 1-tol && yf < 1+tol)	direction[i] |= Y_MAX|Y_ANY;
			if(zf < tol && zf > -tol)			direction[i] |= Z_MIN|Z_ANY;
			else if(zf > 1-tol && zf < 1+tol)	direction[i] |= Z_MAX|Z_ANY;
		}

		// No atoms to add. Do nothing
		if(direction.every((value) => value === 0)) return;

		// Replicate the original atoms
		const fc = this.fractionalCoords;
		const idx = this.atomIdx;
		for(let i=0; i < natoms; ++i) {

			const dir = direction[i];

			if(dir === 0) continue;

			switch(dir & (X_ANY|Y_ANY|Z_ANY)) {

			case X_ANY:
				fc.push(dir & X_MIN ? 1 : 0, fc[3*i+1], fc[3*i+2]);
				idx.push(idx[i]);
				break;

			case Y_ANY:
				fc.push(fc[3*i], dir & Y_MIN ? 1 : 0, fc[3*i+2]);
				idx.push(idx[i]);
				break;

			case Z_ANY:
				fc.push(fc[3*i], fc[3*i+1], dir & Z_MIN ? 1 : 0);
				idx.push(idx[i]);
				break;

			case X_ANY|Y_ANY:
				if((dir & (X_MIN|Y_MIN)) !== (X_MIN|Y_MIN)) {
					fc.push(0, 0, fc[3*i+2]);
					idx.push(idx[i]);
				}
				if((dir & (X_MAX|Y_MIN)) !== (X_MAX|Y_MIN)) {
					fc.push(1, 0, fc[3*i+2]);
					idx.push(idx[i]);
				}
				if((dir & (X_MIN|Y_MAX)) !== (X_MIN|Y_MAX)) {
					fc.push(0, 1, fc[3*i+2]);
					idx.push(idx[i]);
				}
				if((dir & (X_MAX|Y_MAX)) !== (X_MAX|Y_MAX)) {
					fc.push(1, 1, fc[3*i+2]);
					idx.push(idx[i]);
				}
				break;

			case X_ANY|Z_ANY:
				if((dir & (X_MIN|Z_MIN)) !== (X_MIN|Z_MIN)) {
					fc.push(0, fc[3*i+1], 0);
					idx.push(idx[i]);
				}
				if((dir & (X_MAX|Z_MIN)) !== (X_MAX|Z_MIN)) {
					fc.push(1, fc[3*i+1], 0);
					idx.push(idx[i]);
				}
				if((dir & (X_MIN|Z_MAX)) !== (X_MIN|Z_MAX)) {
					fc.push(0, fc[3*i+1], 1);
					idx.push(idx[i]);
				}
				if((dir & (X_MAX|Z_MAX)) !== (X_MAX|Z_MAX)) {
					fc.push(1, fc[3*i+1], 1);
					idx.push(idx[i]);
				}
				break;

			case Y_ANY|Z_ANY:
				if((dir & (Y_MIN|Z_MIN)) !== (Y_MIN|Z_MIN)) {
					fc.push(fc[3*i], 0, 0);
					idx.push(idx[i]);
				}
				if((dir & (Y_MAX|Z_MIN)) !== (Y_MAX|Z_MIN)) {
					fc.push(fc[3*i], 1, 0);
					idx.push(idx[i]);
				}
				if((dir & (Y_MIN|Z_MAX)) !== (Y_MIN|Z_MAX)) {
					fc.push(fc[3*i], 0, 1);
					idx.push(idx[i]);
				}
				if((dir & (Y_MAX|Z_MAX)) !== (Y_MAX|Z_MAX)) {
					fc.push(fc[3*i], 1, 1);
					idx.push(idx[i]);
				}
				break;

			case X_ANY|Y_ANY|Z_ANY:
				if((dir & (X_MIN|Y_MIN|Z_MIN)) !== (X_MIN|Y_MIN|Z_MIN)) {
					fc.push(0, 0, 0);
					idx.push(idx[i]);
				}
				if((dir & (X_MAX|Y_MIN|Z_MIN)) !== (X_MAX|Y_MIN|Z_MIN)) {
					fc.push(1, 0, 0);
					idx.push(idx[i]);
				}
				if((dir & (X_MIN|Y_MAX|Z_MIN)) !== (X_MIN|Y_MAX|Z_MIN)) {
					fc.push(0, 1, 0);
					idx.push(idx[i]);
				}
				if((dir & (X_MAX|Y_MAX|Z_MIN)) !== (X_MAX|Y_MAX|Z_MIN)) {
					fc.push(1, 1, 0);
					idx.push(idx[i]);
				}
				if((dir & (X_MIN|Y_MIN|Z_MAX)) !== (X_MIN|Y_MIN|Z_MAX)) {
					fc.push(0, 0, 1);
					idx.push(idx[i]);
				}
				if((dir & (X_MAX|Y_MIN|Z_MAX)) !== (X_MAX|Y_MIN|Z_MAX)) {
					fc.push(1, 0, 1);
					idx.push(idx[i]);
				}
				if((dir & (X_MIN|Y_MAX|Z_MAX)) !== (X_MIN|Y_MAX|Z_MAX)) {
					fc.push(0, 1, 1);
					idx.push(idx[i]);
				}
				if((dir & (X_MAX|Y_MAX|Z_MAX)) !== (X_MAX|Y_MAX|Z_MAX)) {
					fc.push(1, 1, 1);
					idx.push(idx[i]);
				}
				break;
			}
		}
	}

	// > Clear the structure
	/**
	 * Remove duplicated atoms and recompute bonds
	 */
	private clearStructure(structure: Structure): Structure {

		// Remove duplicated
		const tol = 1e-5;
		const fc = this.fractionalCoords;
		const nfatoms = fc.length / 3;
		const duplicated = Array(nfatoms).fill(false) as boolean[];
		for(let i=0; i < nfatoms-1; ++i) {
			if(duplicated[i]) continue;
			for(let j=i+1; j < nfatoms; ++j) {
				if(duplicated[j]) continue;
				const fdx = fc[3*i] - fc[3*j];
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
			crystal: structure.crystal,
			atoms: [],
			bonds: [],
			look: structure.look,
			volume: structure.volume
		};
		const {basis, origin} = structure.crystal;
		for(let i=0; i < nfatoms; ++i) {

			if(duplicated[i]) continue;

			const fx = this.fractionalCoords[i*3];
			const fy = this.fractionalCoords[i*3+1];
			const fz = this.fractionalCoords[i*3+2];

			out.atoms.push({
				atomZ: structure.atoms[this.atomIdx[i]].atomZ,
				label: structure.atoms[this.atomIdx[i]].label,
				position: [
					fx*basis[0] + fy*basis[3] + fz*basis[6] + origin[0],
					fx*basis[1] + fy*basis[4] + fz*basis[7] + origin[1],
					fx*basis[2] + fy*basis[5] + fz*basis[8] + origin[2],
				]
			});
		}

		// Output structure from the node
		return out;
	}

	/**
	 * Collect the symmetries and open the show symmetries window
	 */
	private openSymmetriesDialog(): void {

		const dataToSend = JSON.stringify({
			inSymmetry: this.inputStructure?.crystal?.spaceGroup ?? "",
			outSymmetry: ""
		});

		createWindow({
						routerPath: "/symmetries",
						width: 700,
						height: 400,
						title: "Show symmetries",
						data: dataToSend
					});
	}

	/**
	 * Update dialog if data changed
	 *
	 * @param outSymmetry - Output symmetry to display, if missing use the input symmetry
	 */
	private updateSymmetriesDialog(outSymmetry?: string): void {

		const inSymmetry = this.inputStructure?.crystal?.spaceGroup ?? "";
		if(!outSymmetry) outSymmetry = inSymmetry;
// console.log("+SYMMETRIES", inSymmetry, "->", outSymmetry);
		const dataToSend = JSON.stringify({
			inSymmetry,
			outSymmetry
		});

		sendToWindow("/symmetries", dataToSend);
	}

	// > Save the node status
	/**
	 * Save the node status
	 *
	 * @returns Entry as JSON of the node status for saving
	 */
	saveStatus(): string {

		const statusToSave = {
			enableFindSymmetries: this.enableFindSymmetries,
			ignoreInputSymmetries: this.ignoreInputSymmetries,
			tolS: this.tolS,
			tolT: this.tolT,
			tolG: this.tolG,
			fillUnitCell: this.fillUnitCell,
			enableApplySymmetries: this.enableApplySymmetries,
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
