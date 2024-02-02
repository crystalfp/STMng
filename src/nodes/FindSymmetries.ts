/**
 * Find the structure symmetries
 *
 * @packageDocumentation
 */
import {sb, type UiParams} from "@/services/Switchboard";
import type {Structure} from "@/types";
import type {FindSymmetriesParams} from "@/electron/types";

export class FindSymmetries {

	private ignoreInputSymmetries = false;
	private structure: Structure | undefined;
	private tolS = .25;
	private tolT = .25;
	private tolG = .10;

	/**
	 * Create the node
	 *
	 * @param id - ID of the Draw Polyhedra node
	 */
	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {
    		this.ignoreInputSymmetries = params.ignoreInputSymmetries as boolean ?? false;
    		this.tolS = params.tolS as number ?? 0.25;
    		this.tolT = params.tolT as number ?? 0.25;
    		this.tolG = params.tolG as number ?? 0.10;

			if(this.ignoreInputSymmetries) {
				sb.setData(this.id, this.structure);
			}
			else if(this.structure) {
				sb.setData(this.id, this.findSymmetries());
			}
		});

		sb.getData(this.id, (data: unknown) => {

			this.structure = data as Structure;

			if(this.ignoreInputSymmetries) {
				sb.setData(this.id, this.structure);
			}
			else if(this.structure) {
				sb.setData(this.id, this.findSymmetries());
			}
		});
	}

	private findSymmetries(): Structure {

		// No atoms, do nothing
		if(!this.structure?.atoms) {
			return {
				crystal: {
					basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
					origin: [0, 0, 0],
					spaceGroup: ""
				},
				atoms: [],
				bonds: [],
				look: {}
			};
		}
		if(this.structure.atoms.length === 0) return this.structure;

		// Extract data for the computational part
		const atomsZ: number[] = [];
		for(const atom of this.structure.atoms) atomsZ.push(atom.atomZ);

		const computeParams: FindSymmetriesParams = {
			ignoreSymmetries: this.ignoreInputSymmetries,
			basis: this.structure.crystal.basis,
			spaceGroup: this.structure.crystal.spaceGroup,
			atomsZ,
			fractionalCoordinates: this.computeFractionalCoordinates(),
			tolS: this.tolS,
			tolT: this.tolT,
			tolG: this.tolG,
		};

		console.log("Computing Finding symmetries", JSON.stringify(computeParams, undefined, 2)); // TBD

		return this.structure;
	}

	private computeFractionalCoordinates(): number[] {

		// Get the basis
		const b = this.structure!.crystal.basis;

		// Compute the determinant of the matrix
		const det = b[0] * (b[4] * b[8] - b[5] * b[7]) -
					b[1] * (b[3] * b[8] - b[5] * b[6]) +
					b[2] * (b[3] * b[7] - b[4] * b[6]);

		// Check if the determinant is zero, which means the matrix is not invertible
		if(det === 0) throw Error("Basis matrix is not invertible");

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
		const fractionalCoords = Array(natoms*3) as number[];

		const {origin} = this.structure!.crystal;

		for(let i=0; i < natoms; ++i) {

			const {position} = this.structure!.atoms[i];
			const cx = position[0] - origin[0];
			const cy = position[1] - origin[1];
			const cz = position[2] - origin[2];

			fractionalCoords[i*3+0] = cx*inverse[0] + cy*inverse[3] + cz*inverse[6];
			fractionalCoords[i*3+1] = cx*inverse[1] + cy*inverse[4] + cz*inverse[7];
			fractionalCoords[i*3+2] = cx*inverse[2] + cy*inverse[5] + cz*inverse[8];
		}

		return fractionalCoords;
	}

	/**
	 * Save the node status
	 *
	 * @returns Entry as JSON of the node status for saving
	 */
	saveStatus(): string {

		const statusToSave = {
			ignoreInputSymmetries: this.ignoreInputSymmetries,
			tolS: this.tolS,
			tolT: this.tolT,
			tolG: this.tolG,
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
