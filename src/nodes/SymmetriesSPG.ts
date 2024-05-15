/**
 * Find and apply symmetries to structure.
 *
 * @packageDocumentation
 */
/* eslint-disable eslint-comments/disable-enable-pair, no-bitwise */
import {sb, type UiParams} from "@/services/Switchboard";
import {createWindow, findAndApplySymmetries, sendToWindow} from "@/services/RoutesClient";
import {resetErrorNotification, showErrorNotification} from "@/services/ErrorNotification";
import type {Structure} from "@/types";
import type {ComputeSymmetriesParams, ComputeSymmetriesOutput} from "@/electron/types";
import {useConfigStore} from "@/stores/configStore";

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

export class SymmetriesSPG {

	private applyInputSymmetries = true;
	private enableFindSymmetries = true;
	private standardizeCell = true;
	private symprecStandardize = -5;
	private symprecDataset = -5;
	private fillUnitCell  = true;
	private showSymmetriesDialog = false;
	private inputStructure: Structure | undefined;

	// > Create the node
	/**
	 * Create the node
	 *
	 * @param id - ID of the Symmetries node
	 */
	constructor(private readonly id: string) {

		// Reset error notification
		resetErrorNotification("symmetries");

		sb.getUiParams(this.id, (params: UiParams) => {

			this.applyInputSymmetries = params.applyInputSymmetries as boolean ?? true;
			this.enableFindSymmetries = params.enableFindSymmetries as boolean ?? true;
			this.standardizeCell = params.standardizeCell as boolean ?? true;
			this.symprecStandardize = params.symprecStandardize as number ?? -5;
			this.symprecDataset = params.symprecDataset as number ?? -5;
			this.fillUnitCell = params.fillUnitCell as boolean ?? true;
			this.showSymmetriesDialog = params.showSymmetriesDialog as boolean ?? false;

			if(this.showSymmetriesDialog) {
				sb.setUiParams(this.id, {showSymmetriesDialog: false});
				this.openSymmetriesDialog();
			}
			else {
				this.computeSymmetries();
			}
		});

		sb.getData(this.id, (data: unknown) => {

			this.inputStructure = data as Structure;

			this.computeSymmetries();
		});
	}

	// > Compute new structure after finding and applying symmetries
	/**
	 * Compute new structure after finding and applying symmetries
	 */
	private computeSymmetries(): void {

		// If no structure do nothing
		if(!this.inputStructure) return;
		const {crystal, atoms} = this.inputStructure;
		if(crystal === undefined) return;

		// If no unit cell or no atoms, copy input structure to output
		if(crystal.basis.every((value) => value === 0) || atoms.length === 0) {
			sb.setData(this.id, this.inputStructure);
			this.showComputedSymmetry();
			return;
		}

		// If no symmetry computation to do, copy input structure to output
		if(!this.applyInputSymmetries && !this.enableFindSymmetries) {
			sb.setData(this.id, this.inputStructure);
			this.showComputedSymmetry();
			return;
		}

		// If only apply symmetries, but no symmetry, copy input structure to output
		const noSymmetries = ["", "P1", "P 1"].includes(crystal.spaceGroup);
		if(this.applyInputSymmetries && !this.enableFindSymmetries && noSymmetries) {
			sb.setData(this.id, this.inputStructure);
			this.showComputedSymmetry();
			return;
		}

		// Extract data for the computational part
		const atomsZ: number[] = [];
		for(const atom of atoms) atomsZ.push(atom.atomZ);

		const fractionalCoordinates = this.computeFractionalCoordinates(this.inputStructure);
		if(fractionalCoordinates.length === 0) {
			sb.setData(this.id, this.inputStructure);
			this.showComputedSymmetry();
			return;
		}

		const params: ComputeSymmetriesParams = {
			basis: crystal.basis,
			spaceGroup: crystal.spaceGroup,
			atomsZ,
			fractionalCoordinates,
			applyInputSymmetries: this.applyInputSymmetries && !noSymmetries,
			enableFindSymmetries: this.enableFindSymmetries,
			standardizeCell: this.standardizeCell,
			symprecStandardize: Math.pow(10, this.symprecStandardize),
			symprecDataset: Math.pow(10, this.symprecDataset),
		};

		findAndApplySymmetries(params)
			.then((response) => {

				if(response.error) throw Error(response.error);

				const out = JSON.parse(response.payload) as ComputeSymmetriesOutput;

				if(out.status !== "") throw Error(out.status);

				const structure = this.fillUnitCell ? this.fillCell(out) : this.buildStructure(out);

				// eslint-disable-next-line unicorn/consistent-destructuring
				if(out.noCellChanges && this.inputStructure) structure.volume = this.inputStructure.volume ?? [];
				sb.setData(this.id, structure);

				this.showComputedSymmetry(structure.crystal.spaceGroup);
			})
			.catch((error: Error) => {
				showErrorNotification(error.message, "symmetries");
				sb.setData(this.id, this.inputStructure);
				this.showComputedSymmetry();
			});
	}

	private showComputedSymmetry(outSymmetry?: string): void {

		const inSymmetry = this.inputStructure?.crystal?.spaceGroup ?? "";
		if(outSymmetry === undefined) outSymmetry = inSymmetry;

		// Update the UI
		const configStore = useConfigStore();
		configStore.control.computedSpaceGroup = outSymmetry;

		// Update the dialog if it is open
		const dataToSend = JSON.stringify({
			inSymmetry,
			outSymmetry
		});

		sendToWindow("/symmetries", dataToSend);
	}

	// > Compute the atoms' fractional coordinates
	/**
	 * Compute the structure atoms' fractional coordinates
	 *
	 * @param structure - The structure whose atoms' coordinates should be transformed into fractional coordinates
	 * @returns The array of fractional coordinates
	 */
	private computeFractionalCoordinates(structure: Structure): number[] {

		// Access the structure basis and atoms cartesian coordinates
		const {crystal, atoms} = structure;
		const b = crystal.basis;

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
		const natoms = atoms.length;
		const fractionalCoords = Array(natoms*3).fill(0) as number[];

		const {origin} = crystal;

		for(let i=0; i < natoms; ++i) {

			const {position} = atoms[i];
			const cx = position[0] - origin[0];
			const cy = position[1] - origin[1];
			const cz = position[2] - origin[2];

			fractionalCoords[i*3]   = cx*inverse[0] + cy*inverse[3] + cz*inverse[6];
			fractionalCoords[i*3+1] = cx*inverse[1] + cy*inverse[4] + cz*inverse[7];
			fractionalCoords[i*3+2] = cx*inverse[2] + cy*inverse[5] + cz*inverse[8];
		}

		return fractionalCoords;
	}

	// > Collect the symmetries and open the show symmetries window
	/**
	 * Collect the symmetries and open the show symmetries window
	 */
	private openSymmetriesDialog(): void {

		const configStore = useConfigStore();

		const dataToSend = JSON.stringify({
			inSymmetry: this.inputStructure?.crystal?.spaceGroup ?? "",
			outSymmetry: configStore.control.computedSpaceGroup
		});

		createWindow({
						routerPath: "/symmetries",
						width: 700,
						height: 400,
						title: "Show symmetries",
						data: dataToSend
					});
	}

	// > Fill unit cell
	/**
	 * Fill unit cell
	 *
	 * @param out - Structure data just computed
	 * @returns Complete structure with unit cell filled
	 */
	private fillCell(out: ComputeSymmetriesOutput): Structure {

		const idx: number[] = [];

		const {basis, spaceGroup, fractionalCoordinates, atomsZ, look, labels} = out;
		const structure: Structure = {
			crystal: {
				basis,
				origin: [0, 0, 0],
				spaceGroup
			},
			atoms: [],
			bonds: [],
			look,
			volume: []
		};

		const tol = 1e-3;

		let natoms = atomsZ.length;
		const direction = Array(natoms).fill(0) as number[];
		for(let i=0; i < natoms; ++i) {

			const xf = fractionalCoordinates[i*3];
			const yf = fractionalCoordinates[i*3+1];
			const zf = fractionalCoordinates[i*3+2];

			// Mark atoms exactly on the border
			if(xf < tol && xf > -tol)          	direction[i]  = X_MIN|X_ANY;
			else if(xf > 1-tol && xf < 1+tol)	direction[i]  = X_MAX|X_ANY;
			if(yf < tol && yf > -tol)			direction[i] |= Y_MIN|Y_ANY;
			else if(yf > 1-tol && yf < 1+tol)	direction[i] |= Y_MAX|Y_ANY;
			if(zf < tol && zf > -tol)			direction[i] |= Z_MIN|Z_ANY;
			else if(zf > 1-tol && zf < 1+tol)	direction[i] |= Z_MAX|Z_ANY;

			idx.push(i);
		}

		// No atoms to add. Do nothing
		if(direction.every((value) => value === 0)) {

			for(let i=0; i < natoms; ++i) {

				const fx = fractionalCoordinates[i*3];
				const fy = fractionalCoordinates[i*3+1];
				const fz = fractionalCoordinates[i*3+2];

				structure.atoms.push({
					atomZ: atomsZ[i],
					label: `${labels[i]}${i}`,
					position: [
						fx*basis[0] + fy*basis[3] + fz*basis[6],
						fx*basis[1] + fy*basis[4] + fz*basis[7],
						fx*basis[2] + fy*basis[5] + fz*basis[8],
					]
				});
			}
			return structure;
		}

		// Replicate the original atoms
		const fc = fractionalCoordinates;
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

		// Finish building the structure
		natoms = fractionalCoordinates.length / 3;
		for(let i=0; i < natoms; ++i) {

			const fx = fractionalCoordinates[i*3];
			const fy = fractionalCoordinates[i*3+1];
			const fz = fractionalCoordinates[i*3+2];

			structure.atoms.push({
				atomZ: atomsZ[idx[i]],
				label: `${labels[idx[i]]}${i}`,
				// label: `${look[atomsZ[idx[i]]].symbol}${i}`,
				position: [
					fx*basis[0] + fy*basis[3] + fz*basis[6],
					fx*basis[1] + fy*basis[4] + fz*basis[7],
					fx*basis[2] + fy*basis[5] + fz*basis[8],
				]
			});
		}
		return structure;
	}

	// > Build structure from the output of the symmetries computation
	/**
	 * Build structure from the output of the symmetries computation
	 *
	 * @param out - Structure data just computed
	 * @returns Complete structure
	 */
	private buildStructure(out: ComputeSymmetriesOutput): Structure {

		const {basis, spaceGroup, fractionalCoordinates, atomsZ, look} = out;
		const structure: Structure = {
			crystal: {
				basis,
				origin: [0, 0, 0],
				spaceGroup
			},
			atoms: [],
			bonds: [],
			look,
			volume: []
		};

		const natoms = atomsZ.length;
		for(let i=0; i < natoms; ++i) {

			const fx = fractionalCoordinates[i*3];
			const fy = fractionalCoordinates[i*3+1];
			const fz = fractionalCoordinates[i*3+2];

			structure.atoms.push({
				atomZ: atomsZ[i],
				label: `${look[atomsZ[i]].symbol}${i}`,
				position: [
					fx*basis[0] + fy*basis[3] + fz*basis[6],
					fx*basis[1] + fy*basis[4] + fz*basis[7],
					fx*basis[2] + fy*basis[5] + fz*basis[8],
				]
			});
		}

		return structure;
	}

	// > Save the node status
	/**
	 * Save the node status
	 *
	 * @returns Entry as JSON of the node status for saving
	 */
	saveStatus(): string {

		const statusToSave = {
			applyInputSymmetries: this.applyInputSymmetries,
			enableFindSymmetries: this.enableFindSymmetries,
			standardizeCell: this.standardizeCell,
			symprecStandardize: this.symprecStandardize,
			symprecDataset: this.symprecDataset,
			fillUnitCell: this.fillUnitCell,
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
