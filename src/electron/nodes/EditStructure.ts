/**
 * Edit a structure
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-08-17
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import {NodeCore} from "../modules/NodeCore";
import {EmptyStructure} from "../modules/EmptyStructure";
import {hasNoUnitCell, cartesianToFractionalCoordinates, hasUnitCell,
		fractionalToCartesianCoordinates, c2f} from "../modules/Helpers";
import {getAtomData, getDataTable} from "../modules/AtomData";
import type {ChannelDefinition, CtrlParams, PositionType, Structure} from "@/types";

type OpType = "Create" | "Delete" | "Change" | "Reset";

export class EditStructure extends NodeCore {

	private inputStructure: Structure | undefined;
	private outputStructure: Structure | undefined;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke",	callback: EditStructure.channelInit.bind(this)},
		{name: "select",	type: "invoke", callback: this.channelSelect.bind(this)},
		{name: "op",		type: "invoke", callback: this.channelOp.bind(this)},
		{name: "convert",	type: "invoke", callback: this.channelConvert.bind(this)},
	];

	/**
	 * Create the node
	 *
	 * @param id - The node ID
	 */
	constructor(id: string) {
		super(id);
		NodeCore.setupChannels(id, this.channels);
	}

	description(): string {
		return "Edit an existing structure by adding, deleting or changing its atoms";
	}

	override fromPreviousNode(data: Structure): void {

		this.inputStructure = data?.atoms.length ? data : new EmptyStructure();
		this.outputStructure = structuredClone(this.inputStructure);
		this.toNextNode(this.outputStructure);
	}

	// > Load/save status
	saveStatus(): string {
		return "";
	}

	loadStatus(): void {
		// No body necessary
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private static channelInit(): CtrlParams {

		const info: {title: string; value: number}[] = [];

		const dataTable = getDataTable();
		const len = dataTable.length;
		for(let i=0; i < len; ++i) {
			const value = i+1;
			const title = `${dataTable[i].symbol} (${value})`;
			info.push({title, value});
		}
		return {
			atomTypes: JSON.stringify(info)
		};
	}

	/**
	 * Channel handler for compute distances and angles
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelSelect(params: CtrlParams): CtrlParams {

		if(!this.outputStructure || this.outputStructure.atoms.length === 0) return {
			details: "[]"
		};

		const idx = params.idx as number;
		const {atoms} = this.outputStructure;

		let invalid = hasNoUnitCell(this.outputStructure.crystal.basis);
		let fractionalCoordinates: number[] = [];
		try {
			if(!invalid) fractionalCoordinates = cartesianToFractionalCoordinates(this.outputStructure);
		}
		// eslint-disable-next-line @stylistic/keyword-spacing
		catch {
			invalid = true;
		}

		const {position, atomZ, label, chain} = atoms[idx];
		const {symbol, rCov} = getAtomData(atomZ);
		const fractional: PositionType = invalid ? [-1, -1, -1] :
				   [fractionalCoordinates[3*idx],
					fractionalCoordinates[3*idx+1],
					fractionalCoordinates[3*idx+2]];
		return {details: JSON.stringify([{index: idx,
							label,
							chain,
							symbol,
							color: "#FF0000",
							position,
							radius: rCov,
							fractional}]),
				atomZ
		};
	}

	/**
	 * Channel handler for edit operations
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelOp(params: CtrlParams): CtrlParams {

		const op = params.action as OpType;
		if(!op) return {status: "noop"};
		if(op === "Create") {

			// Check params
			const atomZ = params.atomZ as number;
			if(!atomZ) return {status: "noop"};
			const label = params.label as string || "Atom";
			const chain = params.chain as string ?? "";
			const x = params.x as number ?? 0;
			const y = params.y as number ?? 0;
			const z = params.z as number ?? 0;
			const useFractional = params.useFractional as boolean ?? false;
			const position: PositionType = useFractional && this.outputStructure &&
			   hasUnitCell(this.outputStructure.crystal.basis) ?
			   							fractionalToCartesianCoordinates(
											this.outputStructure.crystal.basis,
											x, y, z) :
										[x, y, z];
			this.outputStructure?.atoms.push({
				label,
				atomZ,
				chain,
				position
			});
			this.toNextNode(this.outputStructure!);

			return {status: "OK"};
		}
		if(!this.outputStructure || this.outputStructure.atoms.length === 0) return {
			status: "noop"
		};
		const index = params.index as number;
		if(index === undefined || index < 0 || index >= this.outputStructure.atoms.length) {
			return {error: "Index out of range"};
		}
		switch(op) {
			case "Delete": {
				this.outputStructure.bonds.length = 0;
				this.outputStructure.atoms.splice(index, 1);
				break;
			}
			case "Change": {
				const atomZ = params.atomZ as number;
				if(!atomZ) return {error: "Missing atom Z value"};
				this.outputStructure.atoms[index].atomZ = atomZ;

				const label = params.label as string;
				if(label) this.outputStructure.atoms[index].label = label;

				const x = params.x as number;
				if(x === undefined) return {error: "Missing x or fx value"};
				const y = params.y as number;
				if(y === undefined) return {error: "Missing y or fy value"};
				const z = params.z as number;
				if(z === undefined) return {error: "Missing z or fz value"};
				const useFractional = params.useFractional as boolean ?? false;
				this.outputStructure.atoms[index].position =
									useFractional &&
									this.outputStructure &&
			   						hasUnitCell(this.outputStructure.crystal.basis) ?
			   							fractionalToCartesianCoordinates(
											this.outputStructure.crystal.basis,
											x, y, z) :
										[x, y, z];
				break;
			}
			case "Reset": {
				this.outputStructure = structuredClone(this.inputStructure);
				break;
			}
			default: return {error: `Invalid operation ${op as string}`};
		}

		this.toNextNode(this.outputStructure!);
		return {status: "OK"};
	}

	/**
	 * Channel handler for changing coordinates type
	 *
	 * @returns Coordinates
	 */
	private channelConvert(params: CtrlParams): CtrlParams {

		if(!this.outputStructure?.crystal) {
			const x = params.x as number ?? 0;
			const y = params.y as number ?? 0;
			const z = params.z as number ?? 0;
			return {x, y, z, fx: 0, fy: 0, fz: 0};
		}
		if(hasNoUnitCell(this.outputStructure.crystal.basis)) {
			const x = params.x as number ?? 0;
			const y = params.y as number ?? 0;
			const z = params.z as number ?? 0;
			return {x, y, z, fx: 0, fy: 0, fz: 0, error: "No unit cell"};
		}
		if(params.useFractional as boolean ?? false) {
			const x = params.x as number ?? 0;
			const y = params.y as number ?? 0;
			const z = params.z as number ?? 0;
			const [fx, fy, fz] = c2f(this.outputStructure.crystal.basis,
									x, y, z);
			return {fx, fy, fz};
		}
		const fx = params.fx as number ?? 0;
		const fy = params.fy as number ?? 0;
		const fz = params.fz as number ?? 0;
		const [x, y, z] = fractionalToCartesianCoordinates(
										this.outputStructure.crystal.basis,
										fx, fy, fz);
		return {x, y, z};
	}
}
