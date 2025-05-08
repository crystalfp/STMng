/**
 * Measure interatomic distances and angles.
 * The polyhedra volume is computed on the client.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-09
 */
import {NodeCore} from "../modules/NodeCore";
import {getAtomData} from "../modules/AtomData";
import {sendToClient} from "../modules/ToClient";
import {cartesianToFractionalCoordinates, hasNoUnitCell} from "../modules/Helpers";
import type {Structure, CtrlParams, ChannelDefinition,
			 SelectedAtom, PositionType, BondData} from "@/types";

const labels = ["Atom A:", "Atom B:", "Atom C:"];
const colors = ["#FF0000", "#00C300", "#4263FF"];

/** Convert radiants to degrees */
const RAD2DEG = 180/Math.PI;

export class Measures extends NodeCore {

	private structure: Structure | undefined;
    private distanceAB = -1;
    private distanceBC = -1;
    private distanceAC = -1;
    private angleABC = -1;
    private readonly details: SelectedAtom[] = [];

	private readonly channels: ChannelDefinition[] = [
		{name: "compute", type: "invoke", callback: this.channelCompute.bind(this)},
		{name: "bonds",   type: "invoke", callback: this.channelBonds.bind(this)},
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

		sendToClient(this.id, "reset");
		if(!data || data.atoms.length === 0) return;
		this.structure = data;
	}

	// > Load/save status
	saveStatus(): string {return "";}

	loadStatus(): void {
		// No body necessary
	}

	/**
	 * Compute distances and angles between the 0 to 3 atoms selected
	 *
	 * @param idx1 - Index of the first atom selected
	 * @param idx2 - Index of the second atom selected
	 * @param idx3 - Index of the third atom selected
	 */
	private computeDistancesAndAngles(idx1: number | undefined,
									  idx2: number | undefined,
									  idx3: number | undefined): void {

		const {atoms} = this.structure!;

		if(idx1 !== undefined && idx2 !== undefined) {

			// Compute distance between A and B atoms
			const dx1 = atoms[idx1].position[0] - atoms[idx2].position[0];
			const dy1 = atoms[idx1].position[1] - atoms[idx2].position[1];
			const dz1 = atoms[idx1].position[2] - atoms[idx2].position[2];

			this.distanceAB = Math.hypot(dx1, dy1, dz1);

			if(idx3 !== undefined) {

				// Compute distance between C and B atoms
				const dx = atoms[idx3].position[0] - atoms[idx2].position[0];
				const dy = atoms[idx3].position[1] - atoms[idx2].position[1];
				const dz = atoms[idx3].position[2] - atoms[idx2].position[2];

				this.distanceBC = Math.hypot(dx, dy, dz);

				// Compute distance between A and C atoms
				const dx3 = atoms[idx1].position[0] - atoms[idx3].position[0];
				const dy3 = atoms[idx1].position[1] - atoms[idx3].position[1];
				const dz3 = atoms[idx1].position[2] - atoms[idx3].position[2];

				this.distanceAC = Math.hypot(dx3, dy3, dz3);

				// Compute angle ABC
				const dotProduct = dx1*dx+dy1*dy+dz1*dz;
				this.angleABC = Math.acos(dotProduct/(this.distanceAB*this.distanceBC))*RAD2DEG;
			}
		}
		else {
			this.distanceAB = -1;
			this.distanceBC = -1;
			this.distanceAC = -1;
			this.angleABC = -1;
		}
	}

	/**
	 * Compute list of selected atoms details
	 *
	 * @param idx1 - Index of the first atom selected
	 * @param idx2 - Index of the second atom selected
	 * @param idx3 - Index of the third atom selected
	 */
	private computeDetails(idx1: number | undefined,
						   idx2: number | undefined,
						   idx3: number | undefined): void {

		const {atoms} = this.structure!;
		this.details.length = 0;

		let invalid = hasNoUnitCell(this.structure!.crystal.basis);
		let fractionalCoordinates: number[] = [];
		try {
			if(!invalid) fractionalCoordinates = cartesianToFractionalCoordinates(this.structure!);
		}
		// eslint-disable-next-line @stylistic/keyword-spacing
		catch {
			invalid = true;
		}

		if(idx1 !== undefined) {
			const {position, atomZ} = atoms[idx1];
			const {symbol, rCov} = getAtomData(atomZ);
			const fractional: PositionType = invalid ? [-1, -1, -1] :
					[fractionalCoordinates[3*idx1],
					 fractionalCoordinates[3*idx1+1],
					 fractionalCoordinates[3*idx1+2]];
			this.details.push({index: idx1,
							   label: labels[0],
							   symbol,
							   color: colors[0],
							   position,
							   radius: rCov,
							   fractional});
		}
		if(idx2 !== undefined) {
			const {position, atomZ} = atoms[idx2];
			const {symbol, rCov} = getAtomData(atomZ);
			const fractional: PositionType = invalid ? [-1, -1, -1] :
					[fractionalCoordinates[3*idx2],
					 fractionalCoordinates[3*idx2+1],
					 fractionalCoordinates[3*idx2+2]];
			this.details.push({index: idx2,
							   label: labels[1],
							   symbol,
							   color: colors[1],
							   position,
							   radius: rCov,
							   fractional});
		}
		if(idx3 !== undefined) {
			const {position, atomZ} = atoms[idx3];
			const {symbol, rCov} = getAtomData(atomZ);
			const fractional: PositionType = invalid ? [-1, -1, -1] :
					[fractionalCoordinates[3*idx3],
					 fractionalCoordinates[3*idx3+1],
					 fractionalCoordinates[3*idx3+2]];
			this.details.push({index: idx3,
							   label: labels[2],
							   symbol,
							   color: colors[2],
							   position,
							   radius: rCov,
							   fractional});
		}
	}

	// > Channel handlers
	/**
	 * Channel handler for compute distances and angles
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelCompute(params: CtrlParams): CtrlParams {

		if(!this.structure || this.structure.atoms.length === 0) return {
        	distanceAB: -1,
        	distanceBC: -1,
        	distanceAC: -1,
        	angleABC: -1,
        	details: "[]",
		};

		const idx1 = params.idx1 as number;
		const idx2 = params.idx2 as number;
		const idx3 = params.idx3 as number;

		this.computeDistancesAndAngles(idx1, idx2, idx3);
		this.computeDetails(idx1, idx2, idx3);

		return {
        	distanceAB: this.distanceAB,
        	distanceBC: this.distanceBC,
        	distanceAC: this.distanceAC,
        	angleABC: this.angleABC,
        	details: JSON.stringify(this.details),
		};
	}

	/**
	 * Channel handler for compute bonds lengths
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelBonds(params: CtrlParams): CtrlParams {

		if(!this.structure ||
			this.structure.atoms.length === 0 ||
			this.structure.bonds.length === 0) return {
			radius: 0,
			labels: "[]"
		};

		const idx = params.idx as number;
		if(idx === undefined || idx < 0 || idx >= this.structure.atoms.length) return {
			radius: 0,
			labels: "[]"
		};

		const {atoms, bonds} = this.structure;
		const {atomZ, position} = atoms[idx];

		const bondData: BondData[] = [];

		for(const bond of bonds) {

			if(bond.from === idx) {

				const {position: other, atomZ: otherZ} = atoms[bond.to];
				const distance = Math.hypot(position[0]-other[0],
											position[1]-other[1],
											position[2]-other[2]);

				bondData.push({idx: bond.to, atomPosition: other,
							  radius: getAtomData(otherZ).rCov, distance});
			}
			else if(bond.to === idx) {

				const {position: other, atomZ: otherZ} = atoms[bond.from];
				const distance = Math.hypot(position[0]-other[0],
											position[1]-other[1],
											position[2]-other[2]);

				bondData.push({idx: bond.from, atomPosition: other,
							  radius: getAtomData(otherZ).rCov, distance});
			}
		}

		return {
			x: position[0],
			y: position[1],
			z: position[2],
			radius: getAtomData(atomZ).rCov,
			color: colors[0],
			labels: JSON.stringify(bondData)
		};
	}
}
