/**
 * Measure interatomic distances and angles.
 * The polyhedra volume is computed on the client.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-09
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {NodeCore} from "../modules/NodeCore";
import {getAtomData, getAtomicSymbol} from "../modules/AtomData";
import {sendToClient} from "../modules/ToClient";
import {basisToLengthAngles, cartesianToFractionalCoordinates, hasNoUnitCell,
		isHydrogenBond, RAD2DEG} from "../modules/Helpers";
import type {Structure, CtrlParams, ChannelDefinition,
			 SelectedAtom, PositionType, BondData} from "@/types";

const labels = ["Atom A:", "Atom B:", "Atom C:"];
const colors = ["#FF0000", "#00C300", "#4263FF"];

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

		sendToClient(this.id, "new", this.summarizeStructure(data));
		if(!data?.atoms.length) return;
		this.structure = data;
	}

	// > Load/save status
	saveStatus(): string {return "";}

	loadStatus(): void {
		// No body necessary
	}

	/**
	 * Count atoms inside the unit cell
	 *
	 * @param structure - The current structure to count
	 * @returns Atoms count by species
	 */
	private countInsideUnitCell(structure: Structure): Record<string, number> {

		const {atoms, crystal} = structure;
		const {basis} = crystal;
		const natoms = atoms.length;
		if(natoms === 0 || hasNoUnitCell(basis)) return {};
		const include = Array<boolean>(natoms).fill(true);
		const border = Array<boolean>(natoms).fill(false);
		const TOL = 1e-5;
		const TOL2 = TOL*TOL;

		const fc = cartesianToFractionalCoordinates(structure);

		// Remove atoms outside the unit cell
		for(let i=0, j=0; i < natoms; ++i, j+=3) {

			const fx = fc[j];
			if(fx < 0 || fx > 1) {
				include[i] = false;
				continue;
			}
			if(fx < TOL || fx > (1-TOL)) border[i] = true;
			const fy = fc[j+1];
			if(fy < 0 || fy > 1) {
				include[i] = false;
				continue;
			}
			if(fy < TOL || fy > (1-TOL)) border[i] = true;
			const fz = fc[j+2];
			if(fz < 0 || fz > 1) {
				include[i] = false;
				continue;
			}
			if(fz < TOL || fz > (1-TOL)) border[i] = true;
		}

		// Remove duplicated atoms on the borders
		for(let i=0, j=0; i < natoms-1; ++i, j+=3) {

			if(!border[i]) continue;
			let ax = fc[j];
			if(ax > 1-TOL) ax = 0;
			let ay = fc[j+1];
			if(ay > 1-TOL) ay = 0;
			let az = fc[j+2];
			if(az > 1-TOL) az = 0;
			const atomZa = atoms[i].atomZ;

			for(let k=i+1, h=j+3; k < natoms; ++k, h+=3) {

				if(!border[k]) continue;

				const atomZb = atoms[k].atomZ;
				if(atomZa !== atomZb) continue;

				let bx = fc[h];
				if(bx > 1-TOL) bx = 0;
				let by = fc[h+1];
				if(by > 1-TOL) by = 0;
				let bz = fc[h+2];
				if(bz > 1-TOL) bz = 0;

				const dx = ax-bx;
				const dy = ay-by;
				const dz = az-bz;
				const d = dx*dx+dy*dy+dz*dz;
				if(d < TOL2) {
					border[k] = false;
					include[k] = false;
				}
			}
		}

		const counts = new Map<number, number>();
		for(let i=0; i < natoms; ++i) {
			if(!include[i]) continue;
			const z = atoms[i].atomZ;
			const n = counts.get(z);
			counts.set(z, n ? n+1 : 1);
		}

		const out: Record<string, number> = {};
		for(const entry of counts) {
			out[getAtomicSymbol(entry[0])] = entry[1];
		}

		return out;
	}

	/**
	 * Create structure summary
	 *
	 * @param structure - The current structure to summarize
	 * @returns Summary to be visualized by the client
	 */
	private summarizeStructure(structure: Structure): CtrlParams {

		if(!structure?.atoms.length) return {natoms: 0};
		const species = new Map<number, number>();
		for(const atom of structure.atoms) {
			const count = species.get(atom.atomZ) ?? 0;
			species.set(atom.atomZ, count+1);
		}
		const counts: Record<string, number> = {};
		for(const entry of species) {
			counts[getAtomicSymbol(entry[0])] = entry[1];
		}

		const inside = this.countInsideUnitCell(structure);

		const counts2: Record<string, [number, number]> = {};
		for(const full in counts) {
			counts2[full] = [counts[full], inside[full]];
		}

		let nhbonds = 0;
		for(const bond of structure.bonds) {
			if(isHydrogenBond(bond)) ++nhbonds;
		}

		const lengthsAngles = basisToLengthAngles(structure.crystal.basis);

		return {
			step: structure.extra.step,
			natoms: structure.atoms.length,
			nbonds: structure.bonds.length,
			nhbonds,
			counts: JSON.stringify(counts2),
			lengthsAngles,
			origin: structure.crystal.origin,
		};
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

				const atomData = getAtomData(otherZ);
				bondData.push({idx: bond.to, atomPosition: other,
							  radius: atomData.rCov, distance, symbol: atomData.symbol});
			}
			else if(bond.to === idx) {

				const {position: other, atomZ: otherZ} = atoms[bond.from];
				const distance = Math.hypot(position[0]-other[0],
											position[1]-other[1],
											position[2]-other[2]);

				const atomData = getAtomData(otherZ);
				bondData.push({idx: bond.from, atomPosition: other,
							  radius: atomData.rCov, distance, symbol: atomData.symbol});
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
