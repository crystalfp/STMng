/**
 * Find and apply symmetries to the input structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {NodeCore} from "../modules/NodeCore";
import {findAndApplySymmetries} from "../modules/NativeFunctions";
import {createSecondaryWindowWithRetry, isSecondaryWindowOpen,
		sendToSecondaryWindow} from "../modules/WindowsUtilities";
import {sendAlertMessage, sendToClient} from "../modules/ToClient";
import {cartesianToFractionalCoordinates, hasNoUnitCell} from "../modules/Helpers";
import {EmptyStructure} from "../modules/EmptyStructure";
import type {Structure, CtrlParams, ChannelDefinition, BasisType, PositionType, Extra} from "@/types";

/**
 * Output from the native module that computes and find symmetries
 * @notExported
 */
interface ComputeSymmetriesOutput {

	/** Computed basis vectors */
	basis: BasisType;
	/** Computed symmetry */
	spaceGroup: string;
	/** Atoms' atomic numbers */
	atomsZ: number[];
	/** Atoms' computed labels */
	labels: string[];
	/** Atoms pertain to this chain (or empty string) */
	chains: string[];
	/** Computed atoms' fractional coordinates */
	fractionalCoordinates: number[];
	/** True if the cell has been changed */
	noCellChanges: boolean;
	/** Process errors if not the empty string */
	status: string;
	/** Extra structure data */
	extra: Extra;
}

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

/** Space groups that are not symmetries */
const noSymmetriesSpaceGroup = new Set(["", "P1", "P 1", "p1", "p 1"]);

/** Tolerance to check for coincident atoms */
const TOL = 10e-5;

export class ComputeSymmetries extends NodeCore {

	private inputStructure: Structure | undefined;
	private structure: Structure | undefined;
	private applyInputSymmetries = true;
	private enableFindSymmetries = true;
	private standardizeCell = true;
	private symprecStandardize = -1;
	private symprecDataset = -1;
	private fillUnitCell  = true;
	private fillTolerance = -5;
	private standardizeOnly = false;
	private computedSpaceGroup = "";
	private createPrimitiveCell = false;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",    type: "invoke", callback: this.channelInit.bind(this)},
		{name: "compute", type: "invoke", callback: this.channelCompute.bind(this)},
		{name: "window",  type: "send",   callback: this.channelWindow.bind(this)},
	];

	/**
	 * Create the node
	 *
	 * @param id - The node ID
	 */
	constructor(id: string) {
		super(id);
		this.setupChannels(id, this.channels);
	}

	override fromPreviousNode(data: Structure): void {

		if(!data || data.atoms.length === 0) {
			this.toNextNode(new EmptyStructure());
			return;
		}

		this.inputStructure = data;

		this.computeSymmetries();
	}

	// > Load/save status
	saveStatus(): string {
        const statusToSave = {
	        applyInputSymmetries: this.applyInputSymmetries,
	        enableFindSymmetries: this.enableFindSymmetries,
	        standardizeCell: this.standardizeCell,
	        symprecStandardize: this.symprecStandardize,
	        symprecDataset: this.symprecDataset,
	        fillUnitCell: this.fillUnitCell,
			fillTolerance: this.fillTolerance,
	        standardizeOnly: this.standardizeOnly,
			createPrimitiveCell: this.createPrimitiveCell,
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
        this.applyInputSymmetries = params.applyInputSymmetries as boolean ?? true;
        this.enableFindSymmetries = params.enableFindSymmetries as boolean ?? true;
        this.standardizeCell = params.standardizeCell as boolean ?? true;
        this.symprecStandardize = params.symprecStandardize as number ?? -1;
        this.symprecDataset = params.symprecDataset as number ?? -1;
        this.fillUnitCell = params.fillUnitCell as boolean ?? true;
		this.fillTolerance = params.fillTolerance as number ?? -5;
        this.standardizeOnly = params.standardizeOnly as boolean ?? false;
        this.createPrimitiveCell = params.createPrimitiveCell as boolean ?? false;
	}

	// > Compute new structure after finding and applying symmetries
	/**
	 * Compute new structure after finding and applying symmetries
	 */
	private computeSymmetries(): void {

		// If no structure do nothing
		if(!this.inputStructure) return;
		const {crystal, atoms, volume, extra} = this.inputStructure;

		// If no unit cell or no atoms, copy input structure to output
		if(crystal === undefined || hasNoUnitCell(crystal.basis) || atoms.length === 0) {
			this.toNextNode(this.inputStructure);
			this.showComputedSymmetry();
			return;
		}

		// If no symmetry computation to do, copy input structure to output
		if(!this.applyInputSymmetries && !this.enableFindSymmetries) {

			this.structure = this.fillUnitCell ?
								this.fillCellFull(this.inputStructure) : this.inputStructure;
			this.toNextNode(this.structure);
			this.showComputedSymmetry();
			return;
		}

		// If only apply symmetries, but no symmetry, copy input structure to output
		const noSymmetries = noSymmetriesSpaceGroup.has(crystal.spaceGroup);
		if(this.applyInputSymmetries && !this.enableFindSymmetries && noSymmetries) {

			this.structure = this.fillUnitCell ?
								this.fillCellFull(this.inputStructure) : this.inputStructure;

			this.toNextNode(this.structure);
			this.showComputedSymmetry();
			return;
		}

		// If input has volume data, disable find symmetries
		if(volume.length > 0) {

			this.enableFindSymmetries = false;
			sendToClient(this.id, "show", {enableFindSymmetries: false});
		}

		// Prepare parameters for the computational part
		let fractionalCoordinates: number[] = [];
		try {
			fractionalCoordinates = cartesianToFractionalCoordinates(this.inputStructure);
		}
		catch(error: unknown) {
			sendAlertMessage((error as Error).message, "symmetries");
			fractionalCoordinates = [];
		}
		if(fractionalCoordinates.length === 0) {
			this.toNextNode(this.inputStructure);
			this.showComputedSymmetry();
			return;
		}

		// Normalize fractional coordinates
		// for(let i=0; i < fractionalCoordinates.length; ++i) {
		// 	let fr = fractionalCoordinates[i];
		// 	if(fr > 1) fr -= 1;
		// 	else if(fr < 0) fr += 1;
		// 	fractionalCoordinates[i] = fr;
		// }

		// TBD
		// console.log("INPUT:", this.inputStructure.atoms.length);
		// let iidx = -3;
		// for(const atom of this.inputStructure.atoms) {
		// 	iidx += 3;
		// 	if(atom.label !== "CA" || atom.chain !== "A") continue;
		// 	console.log(atom.label, atom.chain, atom.position[0].toFixed(3), atom.position[1].toFixed(3), atom.position[2].toFixed(3), fractionalCoordinates[iidx].toFixed(3), fractionalCoordinates[iidx+1].toFixed(3), fractionalCoordinates[iidx+2].toFixed(3));
		// }

		const basis = new Float64Array(crystal.basis);
		const natoms = atoms.length;
		const outAtomsZ = new Int32Array(natoms);
		for(let i=0; i < natoms; ++i) outAtomsZ[i] = atoms[i].atomZ;
		const outFractionalCoordinates = new Float64Array(fractionalCoordinates);
		const symprecStandardize = 10**this.symprecStandardize;
		const symprecDataset = 10**this.symprecDataset;
		const applyInputSymmetries = this.applyInputSymmetries && !noSymmetries;

		// Do the computation
		const computed = findAndApplySymmetries(basis, crystal.spaceGroup, outAtomsZ,
												outFractionalCoordinates, applyInputSymmetries,
												this.enableFindSymmetries, this.standardizeCell,
												this.standardizeOnly, this.createPrimitiveCell,
												symprecStandardize, symprecDataset);

		// Reformat the returned values
		const atomsZOut = [...computed.atomsZ];
		const labels: string[] = [];
		const chains: string[] = [];

		const repetitions = Math.ceil(atomsZOut.length/atoms.length);
		for(let i=0; i < repetitions; ++i) {

			for(const atom of atoms) {
				labels.push(atom.label);
				const chain = i === 0 ? atom.chain : (atom.chain || "Remaining") + i.toString();
				chains.push(chain);
			}
		}

		// Return results to the client
		const out: ComputeSymmetriesOutput = {
			basis: [...computed.basis] as BasisType,
			spaceGroup: computed.spaceGroup,
			atomsZ: atomsZOut,
			labels,
			chains,
			fractionalCoordinates: [...computed.fractionalCoordinates],
			noCellChanges: computed.noCellChanges,
			status: computed.status,
			extra
		};
		this.structure = this.fillUnitCell ? this.fillCell(out) : this.buildStructure(out);
		if(out.noCellChanges && this.inputStructure) this.structure.volume = volume;

		this.toNextNode(this.structure);

		this.computedSpaceGroup = this.structure.crystal.spaceGroup;
		this.showComputedSymmetry(this.computedSpaceGroup);
	}

	/**
	 * Send computed symmetry to the secondary window that displays it
	 *
	 * @param outSymmetry - Computed symmetry
	 */
	private showComputedSymmetry(outSymmetry?: string): void {

		const inSymmetry = this.inputStructure?.crystal?.spaceGroup ?? "";
		outSymmetry ??= inSymmetry;

		// Update the UI
		sendToClient(this.id, "show", {inSymmetry, outSymmetry});

		// Update the dialog if it is open
		const dataToSend = JSON.stringify({
			inSymmetry,
			outSymmetry
		});
		sendToSecondaryWindow("/symmetries", dataToSend);
	}

	/**
	 * Transform fractional to cartesian coordinates
	 *
	 * @param idx - Atom index
	 * @param fractionalCoordinates - Atoms fractional coordinates
	 * @param basis - Structure basis vectors
	 * @returns Atom position in cartesian coordinates
	 */
	private static fractionalToPosition(idx: number, fractionalCoordinates: number[], basis: BasisType): PositionType {

		const k = idx*3;
		const fx = fractionalCoordinates[k];
		const fy = fractionalCoordinates[k+1];
		const fz = fractionalCoordinates[k+2];

		return [
			fx*basis[0] + fy*basis[3] + fz*basis[6],
			fx*basis[1] + fy*basis[4] + fz*basis[7],
			fx*basis[2] + fy*basis[5] + fz*basis[8],
		];
	}

	// > Fill unit cell
	/**
	 * Fill the unit cell starting from the full structure
	 *
	 * @param structure - The structure to fill
	 * @returns Complete structure with unit cell filled
	 */
	private fillCellFull(structure: Structure): Structure {

		const {crystal, atoms, volume, extra} = structure;
		const {basis, spaceGroup} = crystal;

		// Collect atoms data
		const atomsZ = [];
		const labels = [];
		const chains = [];
		for(const atom of atoms) {
			atomsZ.push(atom.atomZ);
			labels.push(atom.label);
			chains.push(atom.chain);
		}

		let fractionalCoordinates: number[] = [];
		try {
			fractionalCoordinates = cartesianToFractionalCoordinates(structure);
		}
		catch(error: unknown) {
			sendAlertMessage((error as Error).message, "symmetries");
			fractionalCoordinates = [];
		}

		// Prepare the input for fillCell()
		const out: ComputeSymmetriesOutput = {

			basis,
			spaceGroup,
			atomsZ,
			labels,
			chains,
			fractionalCoordinates,
			noCellChanges: true,	// Ignored
			status: "",				// Ignored
			extra
		};

		// Fill the unit cell restoring the volumetric data
		const outStructure = this.fillCell(out);
		outStructure.volume = volume;
		return outStructure;
	}

	/**
	 * Fill the unit cell
	 *
	 * @param out - Structure data just computed
	 * @returns Complete structure with unit cell filled
	 */
	private fillCell(out: ComputeSymmetriesOutput): Structure {

		const idx: number[] = [];
		const MARGIN = 10**this.fillTolerance;

		const {basis, spaceGroup, fractionalCoordinates, atomsZ, labels, chains, extra} = out;
		const structure: Structure = {
			crystal: {
				basis,
				origin: [0, 0, 0],
				spaceGroup
			},
			atoms: [],
			bonds: [],
			volume: [],
			extra
		};

		let natoms = atomsZ.length;
		const direction = Array<number>(natoms).fill(0);
		for(let i=0; i < natoms; ++i) {

			const k = i*3;
			const xf = fractionalCoordinates[k];
			const yf = fractionalCoordinates[k+1];
			const zf = fractionalCoordinates[k+2];

			// Mark atoms exactly on the border
			if(xf < MARGIN && xf > -MARGIN)			direction[i]  = X_MIN|X_ANY;
			else if(xf > 1-MARGIN && xf < 1+MARGIN)	direction[i]  = X_MAX|X_ANY;
			if(yf < MARGIN && yf > -MARGIN)			direction[i] |= Y_MIN|Y_ANY;
			else if(yf > 1-MARGIN && yf < 1+MARGIN)	direction[i] |= Y_MAX|Y_ANY;
			if(zf < MARGIN && zf > -MARGIN)			direction[i] |= Z_MIN|Z_ANY;
			else if(zf > 1-MARGIN && zf < 1+MARGIN)	direction[i] |= Z_MAX|Z_ANY;

			idx.push(i);
		}

		// No atoms to add. Do nothing
		if(direction.every((value) => value === 0)) {

			for(let i=0; i < natoms; ++i) {

				structure.atoms.push({
					atomZ: atomsZ[i],
					label: labels[i],
					chain: chains[i],
					position: ComputeSymmetries.fractionalToPosition(i, fractionalCoordinates, basis)
				});
			}
			return structure;
		}

		// Replicate the original atoms
		const fc = fractionalCoordinates;
		for(let i=0; i < natoms; ++i) {

			const dir = direction[i];
			const k = 3*i;

			if(dir === 0) continue;

			switch(dir & (X_ANY|Y_ANY|Z_ANY)) {

			case X_ANY:
				fc.push(dir & X_MIN ? 1 : 0, fc[k+1], fc[k+2]);
				idx.push(idx[i]);
				break;

			case Y_ANY:
				fc.push(fc[k], dir & Y_MIN ? 1 : 0, fc[k+2]);
				idx.push(idx[i]);
				break;

			case Z_ANY:
				fc.push(fc[k], fc[k+1], dir & Z_MIN ? 1 : 0);
				idx.push(idx[i]);
				break;

			case X_ANY|Y_ANY:
				if((dir & (X_MIN|Y_MIN)) !== (X_MIN|Y_MIN)) {
					fc.push(0, 0, fc[k+2]);
					idx.push(idx[i]);
				}
				if((dir & (X_MAX|Y_MIN)) !== (X_MAX|Y_MIN)) {
					fc.push(1, 0, fc[k+2]);
					idx.push(idx[i]);
				}
				if((dir & (X_MIN|Y_MAX)) !== (X_MIN|Y_MAX)) {
					fc.push(0, 1, fc[k+2]);
					idx.push(idx[i]);
				}
				if((dir & (X_MAX|Y_MAX)) !== (X_MAX|Y_MAX)) {
					fc.push(1, 1, fc[k+2]);
					idx.push(idx[i]);
				}
				break;

			case X_ANY|Z_ANY:
				if((dir & (X_MIN|Z_MIN)) !== (X_MIN|Z_MIN)) {
					fc.push(0, fc[k+1], 0);
					idx.push(idx[i]);
				}
				if((dir & (X_MAX|Z_MIN)) !== (X_MAX|Z_MIN)) {
					fc.push(1, fc[k+1], 0);
					idx.push(idx[i]);
				}
				if((dir & (X_MIN|Z_MAX)) !== (X_MIN|Z_MAX)) {
					fc.push(0, fc[k+1], 1);
					idx.push(idx[i]);
				}
				if((dir & (X_MAX|Z_MAX)) !== (X_MAX|Z_MAX)) {
					fc.push(1, fc[k+1], 1);
					idx.push(idx[i]);
				}
				break;

			case Y_ANY|Z_ANY:
				if((dir & (Y_MIN|Z_MIN)) !== (Y_MIN|Z_MIN)) {
					fc.push(fc[k], 0, 0);
					idx.push(idx[i]);
				}
				if((dir & (Y_MAX|Z_MIN)) !== (Y_MAX|Z_MIN)) {
					fc.push(fc[k], 1, 0);
					idx.push(idx[i]);
				}
				if((dir & (Y_MIN|Z_MAX)) !== (Y_MIN|Z_MAX)) {
					fc.push(fc[k], 0, 1);
					idx.push(idx[i]);
				}
				if((dir & (Y_MAX|Z_MAX)) !== (Y_MAX|Z_MAX)) {
					fc.push(fc[k], 1, 1);
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

		// Finish building the structure removing duplicated atoms
		natoms = fractionalCoordinates.length / 3;
		for(let i=0; i < natoms; ++i) {

			if(ComputeSymmetries.isDuplicated(i, natoms, fractionalCoordinates)) continue;

			structure.atoms.push({
				atomZ: atomsZ[idx[i]],
				label: labels[idx[i]],
				chain: chains[idx[i]],
				position: ComputeSymmetries.fractionalToPosition(i, fractionalCoordinates, basis)
			});
		}
		return structure;
	}

	/**
	 * Check if the atom to test has a duplicated one further in the atoms list
	 *
	 * @param idx - Index of the atom to test
	 * @param natoms - Total number of atoms
	 * @param fractionalCoordinates - Fractional atoms coordinates
	 * @returns - True if the atom to test has a duplicated one further in the atoms list
	 */
	private static isDuplicated(idx: number, natoms: number, fractionalCoordinates: number[]): boolean {

		const k = idx*3;
		const fx = fractionalCoordinates[k];
		const fy = fractionalCoordinates[k+1];
		const fz = fractionalCoordinates[k+2];

		for(let j=idx+1; j < natoms; ++j) {

			const t = j*3;
			const dx = fractionalCoordinates[t] - fx;
			const dy = fractionalCoordinates[t+1] - fy;
			const dz = fractionalCoordinates[t+2] - fz;

			if(dx > TOL || dx < -TOL) continue;
			if(dy > TOL || dy < -TOL) continue;
			if(dz > TOL || dz < -TOL) continue;
			return true;
		}
		return false;
	}

	// > Build structure from the output of the symmetries computation
	/**
	 * Build structure from the output of the symmetries computation
	 *
	 * @param out - Structure data just computed
	 * @returns Complete structure
	 */
	private buildStructure(out: ComputeSymmetriesOutput): Structure {

		const {basis, spaceGroup, fractionalCoordinates, atomsZ, chains, extra, labels} = out;
		const structure: Structure = {
			crystal: {
				basis,
				origin: [0, 0, 0],
				spaceGroup
			},
			atoms: [],
			bonds: [],
			volume: [],
			extra
		};

		const natoms = atomsZ.length;
		for(let i=0; i < natoms; ++i) {

			structure.atoms.push({
				atomZ: atomsZ[i],
				label: labels[i],
				chain: chains[i],
				position: ComputeSymmetries.fractionalToPosition(i, fractionalCoordinates, basis)
			});
		}

		return structure;
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			applyInputSymmetries: this.applyInputSymmetries,
			enableFindSymmetries: this.enableFindSymmetries,
			standardizeCell: this.standardizeCell,
			symprecStandardize: this.symprecStandardize,
			symprecDataset: this.symprecDataset,
			fillUnitCell: this.fillUnitCell,
			fillTolerance: this.fillTolerance,
			standardizeOnly: this.standardizeOnly,
			createPrimitiveCell: this.createPrimitiveCell,
		};
	}

	/**
	 * Channel handler for symmetry parameters change
	 *
	 * @returns Computed symmetry
	 */
	private channelCompute(params: CtrlParams): CtrlParams {

        this.applyInputSymmetries = params.applyInputSymmetries as boolean ?? true;
        this.enableFindSymmetries = params.enableFindSymmetries as boolean ?? true;
        this.standardizeCell = params.standardizeCell as boolean ?? true;
        this.symprecStandardize = params.symprecStandardize as number ?? -1;
        this.symprecDataset = params.symprecDataset as number ?? -1;
        this.fillUnitCell  = params.fillUnitCell as boolean ?? true;
		this.fillTolerance = params.fillTolerance as number ?? -5;
        this.standardizeOnly = params.standardizeOnly as boolean ?? false;
        this.createPrimitiveCell = params.createPrimitiveCell as boolean ?? false;

		this.computeSymmetries();

		return {
			computedSpaceGroup: this.computedSpaceGroup
		};
	}

	/**
	 * Channel handler for symmetry parameters change
	 *
	 * @returns Computed symmetry
	 */
	private channelWindow(): void {

		const dataToSend = JSON.stringify({
			inSymmetry: this.inputStructure?.crystal?.spaceGroup ?? "",
			outSymmetry: this.computedSpaceGroup
		});

		if(isSecondaryWindowOpen("/symmetries")) {

			sendToSecondaryWindow("/symmetries", dataToSend);
		}
		else {
			createSecondaryWindowWithRetry({
				routerPath: "/symmetries",
				width: 700,
				height: 400,
				title: "Show symmetries",
				data: dataToSend
			});
		}
	}
}
