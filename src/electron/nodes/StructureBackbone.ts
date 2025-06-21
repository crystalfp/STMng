/**
 * Display primary structure of data that contains eventually chain data per atom.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-02-28
 */
import {hasUnitCell, invertBasis} from "../modules/Helpers";
import {NodeCore} from "../modules/NodeCore";
import {selectAtomsByKind, type SelectorType} from "../modules/AtomsChooser";
import {sendToClient} from "../modules/ToClient";
import type {BasisType, ChannelDefinition, CtrlParams, PositionType, Structure} from "@/types";

export class StructureBackbone extends NodeCore {

	private inputStructure: Structure | undefined;
	private readonly chains = new Set<string>();
	private enableStructureBackbone = false;
	private selectorKind: SelectorType = "label";
	private atomsSelector = "";
	private selectedChains: string[] = [];
	private radius = 0.3;
	private threshold = 0.9;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",    type: "invoke", callback: this.channelInit.bind(this)},
		{name: "compute", type: "send",   callback: this.channelCompute.bind(this)},
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

		this.inputStructure = data;
		if(!this.inputStructure) return;

		this.chains.clear();
		for(const atom of data.atoms) {
			this.chains.add(atom.chain);
		}
		sendToClient(this.id, "chains", {
			chains: this.chains.size > 1 ? [...this.chains] : [],
			hasCell: hasUnitCell(data.crystal.basis)
		});

		this.computeBackbone();
	}

	// > Load/save status
	saveStatus(): string {
		const statusToSave = this.collectStatus();
		return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

        this.enableStructureBackbone = params.enableStructureBackbone as boolean ?? false;
        this.selectorKind = params.selectorKind as SelectorType ?? "label";
        this.atomsSelector = params.atomsSelector as string ?? "";
		this.radius = params.radius as number ?? 0.3;
		this.threshold = params.threshold as number ?? 0.9;
	}

	/**
	 * Compute backbone nodes and chain indices and send them to client
	 */
	private computeBackbone(): void {

		// Nothing to do
		if(!this.enableStructureBackbone ||
			!this.inputStructure ||
			(this.chains.size > 1 && this.selectedChains.length === 0) ||
		    (this.atomsSelector === "" && this.selectorKind !== "all")) {

			sendToClient(this.id, "positions", {coordinates: [], chainStart: []});
			return;
		}

		const {atoms, crystal} = this.inputStructure;

		const indices = selectAtomsByKind(this.inputStructure, this.selectorKind, this.atomsSelector);
		const indexSet = new Set(indices);
		const coordinates: number[] = [];
		const chainStart: number[] = [0]; // Atom index of the begin of the chain.
										  // Last entry is one more the index of the last atom
										  // of the last chain.
										  // Indices of a chain are from the entries i and i+1 excluded
		let nodeIndex = 0;
		const natoms = atoms.length;

		if(this.chains.size < 2) {
			for(let i=0; i < natoms; ++i) {

				if(indexSet.has(i)) {
					coordinates.push(atoms[i].position[0], atoms[i].position[1], atoms[i].position[2]);
					++nodeIndex;
				}
			}
			chainStart.push(nodeIndex);
		}
		else {
			for(const chain of this.selectedChains) {

				for(let i=0; i < natoms; ++i) {

					if(atoms[i].chain === chain && indexSet.has(i)) {
						coordinates.push(atoms[i].position[0], atoms[i].position[1], atoms[i].position[2]);
						++nodeIndex;
					}
				}
				chainStart.push(nodeIndex);
			}
		}

		const {basis, origin} = crystal;
		if(hasUnitCell(basis) && this.threshold < 1) {
			StructureBackbone.disentangleChains(coordinates, chainStart, basis, origin, this.threshold);
		}
		sendToClient(this.id, "positions", {coordinates, chainStart});
	}

	/**
	 * Follow each chain moving nodes on the same side of the unit cell
	 *
	 * @param coordinates - All chains node coordinates
	 * @param chainStart - Array of (start, end) indices of the nodes
	 * @param basis - Structure basis matrix
	 * @param origin - Structure origin
	 * @param threshold - Threshold to select next node to be moved
	 */
	private static disentangleChains(coordinates: number[], chainStart: number[],
							 		 basis: BasisType, origin: PositionType, threshold: number): void {

		// Convert each point into fractional coordinates
		const inverse = invertBasis(basis);
		const fractionalCoords = Array<number>(coordinates.length);
		for(let i=0; i < coordinates.length; i+=3) {

			const cx = coordinates[i]   - origin[0];
			const cy = coordinates[i+1] - origin[1];
			const cz = coordinates[i+2] - origin[2];

			fractionalCoords[i]   = cx*inverse[0] + cy*inverse[3] + cz*inverse[6];
			fractionalCoords[i+1] = cx*inverse[1] + cy*inverse[4] + cz*inverse[7];
			fractionalCoords[i+2] = cx*inverse[2] + cy*inverse[5] + cz*inverse[8];
		}

		// Follow each chain moving each next node near the previous one
		for(let i=0; i < chainStart.length-1; ++i) {

			// Skip empty chains
			if(chainStart[i] === chainStart[i+1]) continue;

			for(let j=chainStart[i]; j < chainStart[i+1]-1; ++j) {

				const j3 = 3*j;
				const da = fractionalCoords[j3+3] - fractionalCoords[j3];
				const db = fractionalCoords[j3+4] - fractionalCoords[j3+1];
				const dc = fractionalCoords[j3+5] - fractionalCoords[j3+2];

				if(da > threshold) fractionalCoords[j3+3] -= 1;
				else if(da < -threshold) fractionalCoords[j3+3] += 1;
				if(db > threshold) fractionalCoords[j3+4] -= 1;
				else if(db < -threshold) fractionalCoords[j3+4] += 1;
				if(dc > threshold) fractionalCoords[j3+5] -= 1;
				else if(dc < -threshold) fractionalCoords[j3+5] += 1;
			}
		}

		// Convert back into cartesian coordinates
		for(let i=0; i < fractionalCoords.length; i+=3) {

			const fx = fractionalCoords[i];
			const fy = fractionalCoords[i+1];
			const fz = fractionalCoords[i+2];

			coordinates[i]   = fx*basis[0] + fy*basis[3] + fz*basis[6] + origin[0];
			coordinates[i+1] = fx*basis[1] + fy*basis[4] + fz*basis[7] + origin[1];
			coordinates[i+2] = fx*basis[2] + fy*basis[5] + fz*basis[8] + origin[2];
		}
	}

	/**
	 * Collect node status
	 *
	 * @returns Collected status
	 */
	private collectStatus(): CtrlParams {
		return {
			enableStructureBackbone: this.enableStructureBackbone,
			selectorKind: this.selectorKind,
			atomsSelector: this.atomsSelector,
			radius: this.radius,
			threshold: this.threshold,
		};
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return this.collectStatus();
	}

	/**
	 * Channel handler for structure backbone parameters change
	 *
	 * @returns Computed symmetry
	 */
	private channelCompute(params: CtrlParams): void {

        this.enableStructureBackbone = params.enableStructureBackbone as boolean ?? false;
		this.selectedChains = params.selectedChains as string[] ?? [];
        this.selectorKind = params.selectorKind as SelectorType ?? "label";
        this.atomsSelector = params.atomsSelector as string ?? "";
		this.radius = params.radius as number ?? 0.3;
		this.threshold = params.threshold as number ?? 0.9;

		this.computeBackbone();
	}
}
