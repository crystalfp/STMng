/**
 * <<DESCRIPTION>>
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-11
 */
import {NodeCore} from "../modules/NodeCore";
import {sendToClient} from "../modules/ToClient";
import {fingerprintingOganovValle} from "../fingerprint/OganovValleFingerprint";
import {collectionLoadFingerprints, collectionGetNearestStructures,
		collectionGetStructure} from "../modules/CollectionDb";
import {publicDirPath} from "../modules/GetPublicPath";
import {createOrUpdateSecondaryWindow} from "../modules/WindowsUtilities";
import {getAtomData} from "../modules/AtomData";
import {hasNoUnitCell, invertBasis} from "../modules/Helpers";
import type {Atom, Crystal, ChannelDefinition,
			 CtrlParams, FingerprintingParameters,
			 PrototypeAtomsData, Structure} from "@/types";

export class CollectionMatcher extends NodeCore {

	private structure: Structure | undefined;

	// Mirror of the UI reactive state
	private state = {
		enabled: false,
		noThreshold: false,
		threshold: 0.01,
		numberMatches: 1
	};

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke", callback: this.channelInit.bind(this)},
		{name: "state",		type: "send",	callback: this.channelState.bind(this)},
		{name: "show",		type: "invoke", callback: this.channelShow.bind(this)},
	];

	/**
	 * Create the node
	 *
	 * @param id - The node ID
	 */
	constructor(id: string) {
		super(id);
		this.setupChannels(id, this.channels);

		const db = publicDirPath("structure-collection").replaceAll("\\", "/");

		collectionLoadFingerprints(db);
	}

	// > Load/save status
	saveStatus(): string {

		return `"${this.id}": ${JSON.stringify(this.state)}`;
	}

	private initializeState(params: CtrlParams): void {

   	    this.state.enabled = params.enabled as boolean ?? false;
        this.state.noThreshold = params.noThreshold as boolean ?? false;
        this.state.numberMatches = params.numberMatches as number ?? 1;
        this.state.threshold = params.threshold as number ?? 0.01;
	}

	loadStatus(params: CtrlParams): void {

		this.initializeState(params);
	}

	// > Input structure
	override fromPreviousNode(data: Structure): void {

		this.structure = data;

		this.findSimilar();
	}

	// > Computation
	/**
	 * Compute fingerprint of the input structure
	 *
	 * @param atoms - Input structure atoms
	 * @param crystal - Input structure crystal data
	 * @param duplicates - True for atoms that should be ignored
	 * @returns The fingerprint
	 */
	private computeFingerprint(atoms: Atom[],
							   crystal: Crystal,
							   duplicates: boolean[]): Float64Array {

		// Should be the same values set in the preprocessor
		const params: FingerprintingParameters = {

			method: 0,
			areNanoclusters: false,
			cutoffDistance: 10,
			binSize: 0.03,
			peakWidth: 0.01,
			processParallelism: false
		};

		// Compute the effective number of atoms
		let natoms = 0;
		for(let i=0; i < atoms.length; ++i) {

			if(!duplicates[i]) ++natoms;
		}

		const basis: Float64Array = new Float64Array(9);
		const positions: Float64Array = new Float64Array(natoms*3);
		const atomsZ: Int32Array = new Int32Array(natoms);

		for(let i=0; i < 9; ++i) {
			basis[i] = crystal.basis[i];
		}

		for(let i=0, j=0, j3=0; i < atoms.length; ++i) {

			if(duplicates[i]) continue;

			atomsZ[j++] = 1;
			positions[j3++] = atoms[i].position[0] - crystal.origin[0];
			positions[j3++] = atoms[i].position[1] - crystal.origin[1];
			positions[j3++] = atoms[i].position[2] - crystal.origin[2];
		}

		const result = fingerprintingOganovValle(params, basis, natoms, positions, atomsZ);

		return result.fingerprint;
	}

	/**
	 * Mark atoms of the input structure that should be ignored because
	 * are duplicates or outside the unit cell
	 *
	 * @param atoms - Input structure atoms
	 * @param crystal - Input structure crystal data
	 * @returns The excluded markers (one per atom)
	 */
	private markDuplicates(atoms: Atom[], crystal: Crystal): boolean[] {

		const {basis, origin} = crystal;
		const natoms = atoms.length;
		const TOL = 1e-6;

		const inverse = invertBasis(basis);
		const frac: number[][] = [];
		const excluded = Array<boolean>(natoms).fill(false);

		for(let i=0; i < natoms; ++i) {

			const {position} = atoms[i];

			const cx = position[0] - origin[0];
			const cy = position[1] - origin[1];
			const cz = position[2] - origin[2];

			const fx = cx*inverse[0] + cy*inverse[3] + cz*inverse[6];
			const fy = cx*inverse[1] + cy*inverse[4] + cz*inverse[7];
			const fz = cx*inverse[2] + cy*inverse[5] + cz*inverse[8];

			if(fx < 0 || fx > 1 || fy < 0 || fy > 1 || fz < 0 || fz > 1) {
				excluded[i] = true;
			}

			frac.push([fx, fy, fz]);
		}

		// Remove atoms on the opposite sides of the cell
		for(let i=0; i < natoms-1; ++i) {

			if(excluded[i]) continue;

			const li =[
				frac[i][0] < TOL || frac[i][0] > 1-TOL,
				frac[i][1] < TOL || frac[i][1] > 1-TOL,
				frac[i][2] < TOL || frac[i][2] > 1-TOL,
			];
			const liAny = li[0] || li[1] || li[2];

			for(let j=i+1; j < natoms; ++j) {

				if(excluded[j]) continue;

				const dx = Math.abs(frac[i][0] - frac[j][0]);
				const dy = Math.abs(frac[i][1] - frac[j][1]);
				const dz = Math.abs(frac[i][2] - frac[j][2]);

				const ld = [
					dx < TOL,
					dy < TOL,
					dz < TOL
				];
				if(ld[0] && ld[1] && ld[2]) excluded[j] = true;
				else if(!liAny) continue;

				const lj =[
					frac[j][0] < TOL || frac[j][0] > 1-TOL,
					frac[j][1] < TOL || frac[j][1] > 1-TOL,
					frac[j][2] < TOL || frac[j][2] > 1-TOL,
				];
				const ljAny = lj[0] || lj[1] || lj[2];
 				if(!ljAny) continue;

				excluded[j] = this.checkCorrespondence(li, lj, ld);
			}
		}

		return excluded;
	}

	/**
	 * Check if two atoms are in reality the same atom
	 *
	 * @param li - If atom "i" is on the border (for each axis)
	 * @param lj - If atom "j" is on the border (for each axis)
	 * @param ld - If coordinates coincide (for each axis)
	 * @returns True if the two atoms are crystallographic correspondents
	 */
	private checkCorrespondence(li: boolean[], lj: boolean[], ld: boolean[]): boolean {

		// On the corners
		if(li[0] && li[1] && li[2] && lj[0] && lj[1] && lj[2]) return true;

		// On the edges
		if(li[0] && li[1] && lj[0] && lj[1] && ld[2]) return true;
		if(li[0] && li[2] && lj[0] && lj[2] && ld[1]) return true;
		if(li[1] && li[2] && lj[1] && lj[2] && ld[0]) return true;

		// On the facies
		if(li[0] && lj[0] && ld[1] && ld[2]) return true;
		if(li[1] && lj[1] && ld[0] && ld[2]) return true;
		if(li[2] && lj[2] && ld[0] && ld[1]) return true;

		return false;
	}

	/**
	 * Find similar structures from the collection
	 */
	private findSimilar(): void {

		// Nothing to do
		if(!this.state.enabled ||
		   !this.structure?.atoms.length ||
		   hasNoUnitCell(this.structure.crystal.basis)) {

			sendToClient(this.id, "load", {
				titles: [],
				ids: [],
				distances: []
			});
			return;
		}

		const {atoms, crystal} = this.structure;

		// Remove duplicate and outside unit cell atoms
		const duplicates = this.markDuplicates(atoms, crystal);

		// Compute the input structure fingerprint
		const fp = this.computeFingerprint(atoms, crystal, duplicates);

		// Find similar
		const threshold = this.state.noThreshold ? 0 : this.state.threshold;
		const results = collectionGetNearestStructures(fp, this.state.numberMatches, threshold);

		// Prepare the data for the client
		const titles: string[] = [];
		const ids: string[] = [];
		const distances: number[] = [];

		for(const result of results) {
			titles.push(result.title);
			ids.push(result.id);
			distances.push(result.distance!);
		}
		sendToClient(this.id, "load", {
			titles,
			ids,
			distances
		});
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			enabled: this.state.enabled,
        	noThreshold: this.state.noThreshold,
        	numberMatches: this.state.numberMatches,
        	threshold: this.state.threshold
		};
	}

	/**
	 * Channel handler for saving the UI status and start computation
	 */
	private channelState(params: CtrlParams): void {

		this.initializeState(params);

		this.findSimilar();
	}

	/**
	 * Channel handler for display the collection structure matched
	 *
	 * @param params - Params from the client
	 * @returns Params with the operation status
	 */
	private channelShow(params: CtrlParams): CtrlParams {

		const id = params.id as string;
		if(!id) return {result: "Empty file ID"};

		const structure = collectionGetStructure(id);
		if(structure === undefined) {
			const message = `File for ID "${id}" not found`;
			return {error: message};
		}

		const out: PrototypeAtomsData = {
			positions: [],
			labels: [],
			radius: [],
			color: [],
		};

		for(const atom of structure.atoms) {

			out.positions.push(...atom.position);
			out.labels.push(atom.label);

			const ad = getAtomData(atom.atomZ);
			out.radius.push(ad.rCov);
			out.color.push(ad.color);
		}

		const dataForClient: CtrlParams = {
			matrix: structure.crystal.basis,
			atoms: JSON.stringify(out)
		};

		createOrUpdateSecondaryWindow({
			routerPath: "/prototype",
			width: 1400,
			height: 900,
			title: "Collection structure",
			data: dataForClient
		});

		return {result: "Success!"};
	}
}
