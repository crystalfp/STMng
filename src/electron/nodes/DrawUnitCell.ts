/**
 * Display the structure unit cell and replicate structure for a supercell.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import {NodeCore} from "../modules/NodeCore";
import {adjustOrigin} from "../modules/AdjustOrigin";
import {sendVerticesToClient} from "../modules/WindowsUtilities";
import type {Structure, Atom, UiInfo, CtrlParams, ChannelDefinition,
			 PositionType, BasisType, Volume} from "@/types";
import {computeCellVertices} from "./ComputeCellVertices";

export class DrawUnitCell extends NodeCore {

	private inputStructure: Structure | undefined;
	private structure: Structure | undefined;
	private repetitionsA = 1;
	private repetitionsB = 1;
	private repetitionsC = 1;
	private percentA = 0;
	private percentB = 0;
	private percentC = 0;
	private shrink = true;
	private showUnitCell = true;
	private dashedLine = false;
	private showBasisVectors = false;
	private lineColor = "#0000FF";
	private showSupercell = false;
	private supercellColor = "#02A502";
	private dashedSupercell = false;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke", callback: this.channelInit.bind(this)},
		{name: "visible",	type: "send", 	callback: this.channelVisible.bind(this)},
		{name: "repeat",	type: "send", 	callback: this.channelRepetitions.bind(this)},
		{name: "origin",	type: "send", 	callback: this.channelOrigin.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	override notifier(data: Structure): void {

		// No data, output an empty structure
		this.inputStructure = data;
		if(!this.inputStructure|| this.inputStructure.atoms.length === 0) {
			this.outputEmptyStructure();
			sendVerticesToClient(this.id, "cell", []);
			return;
		}

		// Structure should have the unit cell
		const {crystal} = this.inputStructure;
		if(!crystal || crystal.basis.every((value) => value === 0)) {
			this.notify(this.inputStructure);
			sendVerticesToClient(this.id, "cell", []);
			return;
		}

		const {basis, origin, spaceGroup} = crystal;
		const {atoms} = this.inputStructure;

		// Nothing to be changed in the structure
		if(this.repetitionsA === 1 && this.repetitionsB === 1 && this.repetitionsC === 1 &&
		   this.percentA === 0 && this.percentB === 0 && this.percentC === 0) {

			this.notify(this.inputStructure);

			this.computeUnitCell(basis, origin);
			this.computeSupercell(basis, origin);
			this.computeBasisVectors(basis, origin);

			return;
		}

		// Adjust origin if any of the percentages is greather than zero
		this.structure = (this.percentA > 0 || this.percentB > 0 || this.percentC > 0) ?
			adjustOrigin(this.inputStructure,
						 this.percentA/100,
						 this.percentB/100,
						 this.percentC/100,
						 this.shrink)
			:
			{
				crystal: {basis, origin, spaceGroup},
				atoms,
				bonds: [],
				volume: []
			};

		// If there are replications
		if(this.repetitionsA > 1 || this.repetitionsB > 1 || this.repetitionsC > 1) {

			this.structure = this.replicateUnitCell(this.structure);
		}

		// Pass the structure to next node
		if(this.structure) this.notify(this.structure);
		else this.outputEmptyStructure();

		this.computeUnitCell(basis, origin);
		this.computeSupercell(basis, origin);
		this.computeBasisVectors(basis, origin);
	}

	/**
	 * Check if a supercell has been requested
	 *
	 * @returns True if there is a repetition
	 */
	private hasSupercell(): boolean {
		return this.repetitionsA > 1 || this.repetitionsB > 1 || this.repetitionsC > 1;
	}

	/**
	 * Replicate the structure to fill the supercell
	 */
	private replicateUnitCell(structure: Structure): Structure | undefined {

		if(!structure) return;
		const natoms = structure.atoms.length;
		if(natoms === 0) return;
		const bs = structure.crystal.basis;
		const atoms: Atom[] = [];
		for(let a=0; a < this.repetitionsA; ++a) {
			for(let b=0; b < this.repetitionsB; ++b) {
				for(let c=0; c < this.repetitionsC; ++c) {
					for(let i=0; i < natoms; ++i) {
						const position: PositionType = [
							structure.atoms[i].position[0] + a*bs[0] + b*bs[3] + c*bs[6],
							structure.atoms[i].position[1] + a*bs[1] + b*bs[4] + c*bs[7],
							structure.atoms[i].position[2] + a*bs[2] + b*bs[5] + c*bs[8],
						];

						atoms.push({
							position,
							atomZ: structure.atoms[i].atomZ,
							label: structure.atoms[i].label,
						});
					}
				}
			}
		}

		// Remove duplicates
		const tol = 1e-5;
		const outAtoms = atoms.length;
		const duplicated = Array(outAtoms).fill(false) as boolean[];
		for(let i=0; i < outAtoms-1; ++i) {
			if(duplicated[i]) continue;
			for(let j=i+1; j < outAtoms; ++j) {
				if(duplicated[j]) continue;

				const fdx = atoms[i].position[0] - atoms[j].position[0];
				if(fdx < tol && fdx > -tol) {
					const fdy = atoms[i].position[1] - atoms[j].position[1];
					if(fdy < tol && fdy > -tol) {
						const fdz = atoms[i].position[2] - atoms[j].position[2];
						if(fdz < tol && fdz > -tol) {
							duplicated[j] = true;
						}
					}
				}
			}
		}

		// Create out
		const {crystal, volume} = structure;
		const out: Structure = {

			crystal: {
				basis: [
					crystal.basis[0]*this.repetitionsA,
					crystal.basis[1]*this.repetitionsA,
					crystal.basis[2]*this.repetitionsA,
					crystal.basis[3]*this.repetitionsB,
					crystal.basis[4]*this.repetitionsB,
					crystal.basis[5]*this.repetitionsB,
					crystal.basis[6]*this.repetitionsC,
					crystal.basis[7]*this.repetitionsC,
					crystal.basis[8]*this.repetitionsC,
				],
				origin: crystal.origin,
				spaceGroup: crystal.spaceGroup
			},
			atoms: [],
			bonds: [],
			volume: this.replicateVolume(volume)
		};

		for(let i=0; i < outAtoms; ++i) {
			if(duplicated[i]) continue;
			out.atoms.push(atoms[i]);
		}

		// Output the result
		// eslint-disable-next-line @typescript-eslint/consistent-return
		return out;
	}


	/**
	 * Replicate the volume data to fill the supercell
	 *
	 * @param volume - Input volumetric data
	 * @returns The new volume data for the computed supercell
	 */
	private replicateVolume(volume: Volume[]): Volume[] {

		// If no volumetric data or no replications, do nothing
		if(volume.length === 0) return [];
		if(this.repetitionsA === 1 && this.repetitionsB === 1 && this.repetitionsC === 1) return volume;

		const out: Volume[] = [];
		for(const set of volume) {

			const sides: PositionType = [
				set.sides[0]*this.repetitionsA,
				set.sides[1]*this.repetitionsB,
				set.sides[2]*this.repetitionsC,
			];

			const values = [];
			for(let c=0; c < this.repetitionsC; ++c) {
				for(let ic=0; ic < set.sides[2]; ++ic) {
					for(let b=0; b < this.repetitionsB; ++b) {
						for(let ib=0; ib < set.sides[1]; ++ib) {
							for(let a=0; a < this.repetitionsA; ++a) {
								for(let ia=0; ia < set.sides[0]; ++ia) {
									values.push(set.values[ia+set.sides[0]*(ib+ic*set.sides[1])]);
								}
							}
						}
					}
				}
			}
			out.push({sides, values});
		}

		return out;
	}

	saveStatus(): string {
        const statusToSave = {
			showUnitCell: this.showUnitCell,
			dashedLine: this.dashedLine,
			lineColor: this.lineColor,
			showBasisVectors: this.showBasisVectors,
        	repetitionsA: this.repetitionsA,
        	repetitionsB: this.repetitionsB,
        	repetitionsC: this.repetitionsC,
        	showSupercell: this.showSupercell,
        	supercellColor: this.supercellColor,
        	dashedSupercell: this.dashedSupercell,
			percentA: this.percentA,
			percentB: this.percentB,
			percentC: this.percentC,
			shrink: this.shrink,
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

        this.repetitionsA = params.repetitionsA as number ?? 1;
        this.repetitionsB = params.repetitionsB as number ?? 1;
        this.repetitionsC = params.repetitionsC as number ?? 1;
        this.lineColor = params.lineColor as string ?? "#0000FF";
        this.showBasisVectors = params.showBasisVectors as boolean ?? false;
        this.dashedLine = params.dashedLine as boolean ?? false;
        this.showUnitCell = params.showUnitCell as boolean ?? true;
        this.showSupercell = params.showSupercell as boolean ?? this.hasSupercell();
        this.supercellColor = params.supercellColor as string ?? "#16A004";
        this.dashedSupercell = params.dashedSupercell as boolean ?? false;
        this.percentA = params.percentA as number ?? 0;
        this.percentB = params.percentB as number ?? 0;
        this.percentC = params.percentC as number ?? 0;
        this.shrink = params.shrink as boolean ?? true;
	}

	getUiInfo(): UiInfo {

		return {
			id: this.id,
			ui: "DrawUnitCellCtrl",
			graphic: "out",
			channels: this.channels.map((channel) => channel.name)
		};
	}

	// > Output an empty structure
	/**
	 * Output an empty structure
	 */
	private outputEmptyStructure(): void {

		this.notify({
			crystal: {
				basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
				origin: [0, 0, 0],
				spaceGroup: ""
			},
			atoms: [],
			bonds: [],
			volume: []
		});
	}

	/**
	 * Send data to draw the unit cell
	 *
	 * @param basis - The cell basis vectors
	 * @param orig - The cell origin
	 */
	private computeUnitCell(basis: BasisType, orig: PositionType): void {

		// If no unit cell or not visible send an empty coords array
		if(basis.every((value: number) => value === 0)) {
			sendVerticesToClient(this.id, "cell", []);
			return;
		}

		const vertices = computeCellVertices(orig, basis);

		// Send vertices
		sendVerticesToClient(this.id, "cell", vertices);
	}

	/**
	 * Send data to draw the supercell
	 *
	 * @param basis - The cell basis vectors
	 * @param orig - The cell origin
	 */
	private computeSupercell(basis: BasisType, orig: PositionType): void {

		// If no unit cell send an empty coords array
		if(basis.every((value: number) => value === 0))  {
			sendVerticesToClient(this.id, "supercell", []);
			return;
		}

		// If no supercell send an empty coords array
		if(this.repetitionsA === 1 && this.repetitionsB === 1 && this.repetitionsC === 1)  {
			sendVerticesToClient(this.id, "supercell", []);
			return;
		}

		// Supercell basis
		const scb: BasisType = [
			basis[0]*this.repetitionsA,
			basis[1]*this.repetitionsA,
			basis[2]*this.repetitionsA,
			basis[3]*this.repetitionsB,
			basis[4]*this.repetitionsB,
			basis[5]*this.repetitionsB,
			basis[6]*this.repetitionsC,
			basis[7]*this.repetitionsC,
			basis[8]*this.repetitionsC,
		];

		// Supercell vertices coordinates
		const vertices = computeCellVertices(orig, scb);

		// Send vertices
		sendVerticesToClient(this.id, "supercell", vertices);
	}

	/**
	 * Send data to draw the basis vectors
	 *
	 * @param basis - The cell basis vectors
	 * @param orig - The cell origin
	 */
	private computeBasisVectors(basis: BasisType, orig: PositionType): void {

		// No unit cell, do nothing
		if(basis.every((value: number) => value === 0))  {
			sendVerticesToClient(this.id, "vectors", []);
			return;
		}

		// Send basis and origin
		const combined = [
			basis[0],
			basis[1],
			basis[2],
			basis[3],
			basis[4],
			basis[5],
			basis[6],
			basis[7],
			basis[8],
			orig[0],
			orig[1],
			orig[2],
		];

		sendVerticesToClient(this.id, "vectors", combined);
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			showUnitCell: this.showUnitCell,
			dashedLine: this.dashedLine,
			lineColor: this.lineColor,
			showBasisVectors: this.showBasisVectors,
        	repetitionsA: this.repetitionsA,
        	repetitionsB: this.repetitionsB,
        	repetitionsC: this.repetitionsC,
        	showSupercell: this.showSupercell,
        	supercellColor: this.supercellColor,
        	dashedSupercell: this.dashedSupercell,
			percentA: this.percentA,
			percentB: this.percentB,
			percentC: this.percentC,
			shrink: this.shrink,
		};
	}

	/**
	 * Channel handler for the change of visibility
	 *
	 * @param params - Parameters from the client
	 */
	private channelVisible(params: CtrlParams): void {
        this.showBasisVectors = params.showBasisVectors as boolean;
        this.showUnitCell = params.showUnitCell as boolean;
        this.showSupercell = params.showSupercell as boolean;
	}

	/**
	 * Channel handler for the change repetitions
	 *
	 * @param params - Parameters from the client
	 */
	private channelRepetitions(params: CtrlParams): void {

        this.repetitionsA = params.repetitionsA as number ?? 1;
        this.repetitionsB = params.repetitionsB as number ?? 1;
        this.repetitionsC = params.repetitionsC as number ?? 1;

		if(!this.inputStructure) return;
		const {basis, origin} = this.inputStructure.crystal;

		// If there are replications
		if(this.repetitionsA > 1 || this.repetitionsB > 1 || this.repetitionsC > 1) {

			this.structure = this.replicateUnitCell(this.inputStructure);
		}
		this.computeSupercell(basis, origin);

		// Pass the structure to next node
		if(this.structure) this.notify(this.structure);
		else this.outputEmptyStructure();
	}

	/**
	 * Channel handler for the change adjust origin
	 *
	 * @param params - Parameters from the client
	 */
	private channelOrigin(params: CtrlParams): void {
        this.percentA = params.percentA as number ?? 0;
        this.percentB = params.percentB as number ?? 0;
        this.percentC = params.percentC as number ?? 0;
        this.shrink = params.shrink as boolean ?? true;

		if(!this.inputStructure) return;

		const {crystal} = this.inputStructure;
		const {basis, origin} = crystal;
		const {atoms} = this.inputStructure;

		// Adjust origin if any of the percentages is greather than zero
		this.structure = (this.percentA > 0 || this.percentB > 0 || this.percentC > 0) ?
			adjustOrigin(this.inputStructure,
						 this.percentA/100,
						 this.percentB/100,
						 this.percentC/100,
						 this.shrink)
			:
			{
				crystal,
				atoms,
				bonds: [],
				volume: []
			};

		// If there are replications
		if(this.repetitionsA > 1 || this.repetitionsB > 1 || this.repetitionsC > 1) {

			this.structure = this.replicateUnitCell(this.structure);
		}

		// Pass the structure to next node
		if(this.structure) this.notify(this.structure);
		else this.outputEmptyStructure();

		this.computeUnitCell(basis, origin);
		this.computeSupercell(basis, origin);
		this.computeBasisVectors(basis, origin);
	};
}
