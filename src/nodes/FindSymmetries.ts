/**
 * Find structure symmetries using the KPLOT program
 *
 * @packageDocumentation
 */
import {sb, type UiParams} from "@/services/Switchboard";
import type {Structure} from "@/types";
import type {FindSymmetriesParams} from "@/electron/types";
import {findSymmetries} from "@/services/RoutesClient";

export class FindSymmetries {

	private bypassComputation = false;
	private ignoreInputSymmetries = false;
	private structure: Structure | undefined;
	private tolS = .25;
	private tolT = .25;
	private tolG = .10;

	/**
	 * Create the node
	 *
	 * @param id - ID of the Find Symmetries node
	 */
	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {
    		this.bypassComputation = params.bypassComputation as boolean ?? false;
    		this.ignoreInputSymmetries = params.ignoreInputSymmetries as boolean ?? false;
    		this.tolS = params.tolS as number ?? 0.25;
    		this.tolT = params.tolT as number ?? 0.25;
    		this.tolG = params.tolG as number ?? 0.10;

			if(this.bypassComputation) {
				sb.setData(this.id, this.structure);
				sb.setUiParams(this.id, {errorMessage: ""});
			}
			else if(this.structure) {
				this.findAndReturnSymmetries();
			}
		});

		sb.getData(this.id, (data: unknown) => {

			this.structure = data as Structure;

			if(this.bypassComputation) {
				sb.setData(this.id, this.structure);
				sb.setUiParams(this.id, {errorMessage: ""});
			}
			else if(this.structure) {
				this.findAndReturnSymmetries();
			}
		});
	}

	/**
	 * Find structure symmetries and return the updated structure
	 *
	 * @returns The structure with the new symmetries
	 */
	private findAndReturnSymmetries(): void {

		// No atoms, do nothing
		if(!this.structure?.atoms) {
			sb.setData(this.id, {
				crystal: {
					basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
					origin: [0, 0, 0],
					spaceGroup: ""
				},
				atoms: [],
				bonds: [],
				look: {}
			});
			return;
		}
		if(this.structure.atoms.length === 0) {
			sb.setData(this.id, this.structure);
			return;
		}

		// Extract data for the computational part
		const atomsZ: number[] = [];
		for(const atom of this.structure.atoms) atomsZ.push(atom.atomZ);

		// Send params to the computational part
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

		// Find symmetries on the main process
		findSymmetries(computeParams)
			.then((sts) => {
				if(sts.error) throw Error(sts.error);
				sb.setData(this.id, JSON.parse(sts.payload));
				sb.setUiParams(this.id, {
					errorMessage: ""
				});
			})
			.catch((error: Error) => {
				sb.setUiParams(this.id, {
					errorMessage: error.message
				});
			});
	}

	/**
	 * Extract fractional coordinates from the loaded structure
	 *
	 * @returns Array of fractional coordinates
	 */
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
			bypassComputation: this.bypassComputation,
			ignoreInputSymmetries: this.ignoreInputSymmetries,
			tolS: this.tolS,
			tolT: this.tolT,
			tolG: this.tolG,
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
