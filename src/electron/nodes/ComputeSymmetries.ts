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
import {createOrUpdateSecondaryWindow, isSecondaryWindowOpen,
		sendToSecondaryWindow} from "../modules/WindowsUtilities";
import {sendAlertToClient, sendToClient} from "../modules/ToClient";
import {cartesianToFractionalCoordinates, hasNoUnitCell} from "../modules/Helpers";
import {EmptyStructure} from "../modules/EmptyStructure";
import {PointGroupAnalyzer} from "../modules/PointGroupAnalyzer";
import type {Structure, Atom, CtrlParams, ChannelDefinition,
			 BasisType, PositionType, Extra} from "@/types";

/**
 * Output from the native module that computes and find symmetries
 * @notExported
 */
interface ComputeSymmetriesOutput {

	/** Computed basis vectors */
	basis: BasisType;
	/** Computed symmetry */
	spaceGroup: string;
	/** International symmetry symbol */
	intlSymbol: string;
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

/** Tolerance to check for coincident atoms on output is 2/3 of minimum rCov */
const TOL = 0.21;

/**
 * Remove duplicated atoms in cartesian space
 *
 * @param structure - Output structure to be cleaned
 */
const removeDuplicates = (structure: Structure): void => {

	const natoms = structure.atoms.length;
	if(natoms === 0) return;
	const {atoms} = structure;
	const uniqueAtoms: Atom[] = [];

	for(let i=0; i < natoms; ++i) {

		const atom = atoms[i];

		let unique = true;
		for(let j=i+1; j < natoms; ++j) {

			const atom2 = atoms[j];
			if(atom.atomZ === atom2.atomZ) {
				const dx = atom.position[0] - atom2.position[0];
				const dy = atom.position[1] - atom2.position[1];
				const dz = atom.position[2] - atom2.position[2];
				if(Math.abs(dx) < TOL && Math.abs(dy) < TOL && Math.abs(dz) < TOL) {
					unique = false;
					break;
				}
			}
		}
		if(unique) uniqueAtoms.push(atom);
	}

	structure.atoms = uniqueAtoms;
};

export class ComputeSymmetries extends NodeCore {

	private inputStructure: Structure | undefined;
	private structure: Structure | undefined;
	private outputStructure: Structure | undefined;
	private applyInputSymmetries = true;
	private enableFindSymmetries = true;
	private standardizeCell = true;
	private symprecStandardize = -1;
	private symprecDataset = -1;
	private fillUnitCell  = true;
	private fillTolerance = -5;
	private standardizeOnly = false;
	private computedSpaceGroup = "";
	private intlSymbol = "";
	private showIntlSymbol = true;
	private createPrimitiveCell = false;
	private computePointGroup = false;
	private pointGroup = "";
	private positionTolerance = 0.3;
	private eigenvalueTolerance = 0.01;
	private pointGroupAnalyzer = new PointGroupAnalyzer();

	private readonly channels: ChannelDefinition[] = [
		{name: "init",   		 type: "invoke", callback: this.channelInit.bind(this)},
		{name: "compute", 		 type: "send",   callback: this.channelCompute.bind(this)},
		{name: "window",  		 type: "send",   callback: this.channelWindow.bind(this)},
		{name: "do-point-group", type: "send",   callback: this.channelDoPointGroup.bind(this)},
		{name: "intl", 			 type: "send",   callback: this.channelIntl.bind(this)},
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

		if(!data?.atoms.length) {
			this.toNextNode(new EmptyStructure());
			sendToClient(this.id, "input-symmetries", {noInputSymmetries: true});
			return;
		}

		this.inputStructure = data;

		const noInputSymmetries = noSymmetriesSpaceGroup.has(data.crystal.spaceGroup);

		sendToClient(this.id, "input-symmetries", {
			noInputSymmetries,
			applyInputSymmetries: this.applyInputSymmetries
		});

		this.outputStructure = this.computeSymmetries();

		if(this.outputStructure) {
			removeDuplicates(this.outputStructure);
			this.toNextNode(this.outputStructure);
		}
		else {
			this.displaySymmetries("");
			return;
		}

		this.pointGroup = this.computePointGroup ? this.pointGroupAnalyzer.analyze(
				this.outputStructure,
				this.positionTolerance,
				this.eigenvalueTolerance
			) : "";

		this.displaySymmetries(this.pointGroup, this.outputStructure.crystal.spaceGroup);
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
			computePointGroup: this.computePointGroup,
			positionTolerance: this.positionTolerance,
			eigenvalueTolerance: this.eigenvalueTolerance,
			showIntlSymbol: this.showIntlSymbol,
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
        this.computePointGroup = params.computePointGroup as boolean ?? false;
        this.positionTolerance = params.positionTolerance as number ?? 0.3;
        this.eigenvalueTolerance = params.eigenvalueTolerance as number ?? 0.01;
		this.showIntlSymbol = params.showIntlSymbol as boolean ?? true;
	}

	// > Compute new structure after finding and applying symmetries
	/**
	 * Compute new structure after finding and applying symmetries
	 *
	 * @returns The structure with the computed symmetries
	 */
	private computeSymmetries(): Structure | undefined {

		// If no structure do nothing
		if(!this.inputStructure) return;
		const {crystal, atoms, volume, extra} = this.inputStructure;

		// If no unit cell or no atoms, copy input structure to output
		if(crystal === undefined || hasNoUnitCell(crystal.basis) || atoms.length === 0) {
			return this.inputStructure;
		}

		// If no symmetry computation to do, copy input structure to output
		if(!this.applyInputSymmetries && !this.enableFindSymmetries) {

			this.structure = this.fillUnitCell ?
								this.fillCellFull(this.inputStructure) : this.inputStructure;
			return this.structure;
		}

		// If only apply symmetries, but no symmetry, copy input structure to output
		const noSymmetries = noSymmetriesSpaceGroup.has(crystal.spaceGroup);
		if(this.applyInputSymmetries && !this.enableFindSymmetries && noSymmetries) {

			this.structure = this.fillUnitCell ?
								this.fillCellFull(this.inputStructure) : this.inputStructure;

			return this.structure;
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
			sendAlertToClient((error as Error).message, {node: "symmetries"});
			fractionalCoordinates = [];
		}
		if(fractionalCoordinates.length === 0) {
			return this.inputStructure;
		}

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
			intlSymbol: computed.intlSymbol,
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

		this.computedSpaceGroup = computed.spaceGroup;
		this.intlSymbol = computed.intlSymbol;

		if(computed.status !== "") {
			sendAlertToClient(computed.status, {node: "symmetries"});
		}

		return this.structure;
	}

	/**
	 * Send computed symmetry to the UI and to the secondary window that displays it
	 *
	 * @param pointGroup - Point group symbol or empty string if not computed
	 * @param outSymmetry - Computed symmetry
	 */
	private displaySymmetries(pointGroup: string, outSymmetry?: string): void {

		const inSymmetry = this.inputStructure?.crystal?.spaceGroup ?? "";
		outSymmetry ??= inSymmetry;
		const intlSymbol = this.intlSymbol;

		// Update the UI
		sendToClient(this.id, "show", {inSymmetry, outSymmetry, pointGroup, intlSymbol});

		// Update the dialog if it is open
		if(isSecondaryWindowOpen("/symmetries")) {

			const dataToSend = JSON.stringify({
				inSymmetry,
				outSymmetry,
				pointGroup,
				intlSymbol,
				showIntlSymbol: this.showIntlSymbol,
			});
			sendToSecondaryWindow("/symmetries", dataToSend);
		}
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
			sendAlertToClient((error as Error).message, {node: "symmetries"});
			fractionalCoordinates = [];
		}

		// Prepare the input for fillCell()
		const out: ComputeSymmetriesOutput = {

			basis,
			spaceGroup,
			intlSymbol: "",
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

		// Finish building the structure (removing duplicated atoms is done afterwards)
		natoms = fractionalCoordinates.length / 3;
		for(let i=0; i < natoms; ++i) {

			structure.atoms.push({
				atomZ: atomsZ[idx[i]],
				label: labels[idx[i]],
				chain: chains[idx[i]],
				position: ComputeSymmetries.fractionalToPosition(i, fractionalCoordinates, basis)
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
			computePointGroup: this.computePointGroup,
			positionTolerance: this.positionTolerance,
			eigenvalueTolerance: this.eigenvalueTolerance,
			pointGroup: this.pointGroup,
			intlSymbol: this.intlSymbol,
			showIntlSymbol: this.showIntlSymbol,
		};
	}

	/**
	 * Channel handler for symmetry parameters change
	 *
	 * @returns Computed symmetry
	 */
	private channelCompute(params: CtrlParams): void {

        this.applyInputSymmetries = params.applyInputSymmetries as boolean ?? true;
        this.enableFindSymmetries = params.enableFindSymmetries as boolean ?? true;
        this.standardizeCell = params.standardizeCell as boolean ?? true;
        this.symprecStandardize = params.symprecStandardize as number ?? -1;
        this.symprecDataset = params.symprecDataset as number ?? -1;
        this.fillUnitCell  = params.fillUnitCell as boolean ?? true;
		this.fillTolerance = params.fillTolerance as number ?? -5;
        this.standardizeOnly = params.standardizeOnly as boolean ?? false;
        this.createPrimitiveCell = params.createPrimitiveCell as boolean ?? false;

		this.outputStructure = this.computeSymmetries();

		if(this.outputStructure) {
			removeDuplicates(this.outputStructure);
			this.toNextNode(this.outputStructure);
		}
		else {
			this.displaySymmetries("");
			return;
		}

		this.pointGroup = this.computePointGroup ? this.pointGroupAnalyzer.analyze(
				this.outputStructure,
				this.positionTolerance,
				this.eigenvalueTolerance
			) : "";

		this.displaySymmetries(this.pointGroup, this.outputStructure?.crystal.spaceGroup);
	}

	/**
	 * Channel handler for show international symbol parameters change
	 *
	 * @param params - Show international symbol parameter
	 */
	private channelIntl(params: CtrlParams): void {
		this.showIntlSymbol = params.showIntlSymbol as boolean ?? true;

		// Update the dialog if it is open
		if(isSecondaryWindowOpen("/symmetries")) {

			const dataToSend = JSON.stringify({
				showIntlSymbol: this.showIntlSymbol,
			});
			sendToSecondaryWindow("/symmetries", dataToSend);
		}

	}

	/**
	 * Channel handler for point group parameters change
	 *
	 * @param params - Point group analyzer parameters
	 */
	private channelDoPointGroup(params: CtrlParams): void {

		this.computePointGroup = params.computePointGroup as boolean ?? false;
        this.positionTolerance = params.positionTolerance as number ?? 0.3;
        this.eigenvalueTolerance = params.eigenvalueTolerance as number ?? 0.01;

		this.pointGroup = this.computePointGroup ? this.pointGroupAnalyzer.analyze(
				this.outputStructure,
				this.positionTolerance,
				this.eigenvalueTolerance
			) : "";

		this.displaySymmetries(this.pointGroup, this.outputStructure?.crystal.spaceGroup);
	}

	/**
	 * Channel handler for symmetry dialog display
	 */
	private channelWindow(): void {

		const dataToSend = JSON.stringify({
			inSymmetry: this.inputStructure?.crystal?.spaceGroup ?? "",
			outSymmetry: this.computedSpaceGroup,
			pointGroup: this.pointGroup,
			intlSymbol: this.intlSymbol,
			showIntlSymbol: this.showIntlSymbol,
		});

		createOrUpdateSecondaryWindow({
			routerPath: "/symmetries",
			width: 700,
			height: 400,
			title: "Show symmetries",
			data: dataToSend
		});
	}
}
