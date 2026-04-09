/**
 * Extract the enclosing polyhedra.
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
import {checkAtomsSelector, selectAtomsByKind,
		type SelectorType} from "../modules/AtomsChooser";
import {getAtomData} from "../modules/AtomData";
import {sendPolyhedraToClient} from "../modules/ToClient";
import {BondType} from "../../services/SharedConstants";
import type {Structure, CtrlParams, ChannelDefinition} from "@/types";

export class DrawPolyhedra extends NodeCore {

	private structure: Structure | undefined;
	private color = "#FFFFFF80";
	private labelKind: SelectorType = "symbol";
	private atomsSelector = "";
	private showPolyhedra = true;
	private colorByCenterAtom = true;
	private opacityByCenterAtom = 0.5;
	private readonly centerAtomsColor: string[] = [];
	private constrainVertices = "any";
	private countVertices = 3;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke", callback: this.channelInit.bind(this)},
		{name: "look",		type: "send", 	callback: this.channelLook.bind(this)},
		{name: "select",	type: "invoke", callback: this.channelSelect.bind(this)},
		{name: "constrain",	type: "send", 	callback: this.channelConstrain.bind(this)},
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

	description(): string {
		return "Draw polyhedra and triangles passing through atoms bonded to selected ones";
	}

	override fromPreviousNode(data: Structure): void {

		this.structure = data;
		if(!data?.atoms.length || data.bonds.length === 0) {
			sendPolyhedraToClient(this.id, "vertices", [], []);
			return;
		}

		// Extract the polyhedrons vertices
		const islands = this.createVerticeLists();
		if(islands.length === 0) {
			sendPolyhedraToClient(this.id, "vertices", [], []);
			return;
		}

		sendPolyhedraToClient(this.id, "vertices", islands, this.centerAtomsColor);
	}

	// > Load/save status
	saveStatus(): string {
        const statusToSave = {
			color: this.color,
			labelKind: this.labelKind,
			atomsSelector: this.atomsSelector,
			showPolyhedra: this.showPolyhedra,
			colorByCenterAtom: this.colorByCenterAtom,
			opacityByCenterAtom: this.opacityByCenterAtom,
			constrainVertices: this.constrainVertices,
        	countVertices: this.countVertices
		};
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

		this.color = params.color as string ?? "#FFFFFF80";
		this.labelKind = params.labelKind as SelectorType ?? "symbol";
		this.atomsSelector = params.atomsSelector as string ?? "";
		this.showPolyhedra = params.showPolyhedra as boolean ?? true;
		this.colorByCenterAtom = params.colorByCenterAtom as boolean ?? true;
		this.opacityByCenterAtom = params.opacityByCenterAtom as number ?? 0.5;
        this.constrainVertices = params.constrainVertices as string ?? "any";
        this.countVertices = params.countVertices as number ?? 3;
	}

	/**
	 * Constrain on the number of vertices
	 *
	 * @param count - Count of connected atoms
	 * @returns True if the count satisfies the constrain
	 */
	private countConstrain(count: number): boolean {

		switch(this.constrainVertices) {
			case "any":
				return count >= 3;
			case "exact":
				return count === this.countVertices;
			case "min":
				return count >= this.countVertices;
		}
		return false;
	}

	/**
	 * Compute vertices
	 *
	 * @returns List of lists of polyhedrons vertices
	 */
	private createVerticeLists(): number[][] {

		// Extract structure parts
		const {atoms, bonds} = this.structure!;

		// Sanity checks
		const natoms = atoms.length;
		if(natoms < 3) return [];
		if(bonds.length === 0) return [];

		// Select the polyhedra center atoms
		const centerIdx = selectAtomsByKind(this.structure!, this.labelKind, this.atomsSelector);

		// Create lists of connected atoms (island)
		const islands: number[][] = [];
		this.centerAtomsColor.length = 0;

		for(const idx of centerIdx) {
			const connected = [];
			for(const {from, to, type} of bonds) {

				if(type !== BondType.normal) continue;
				if(from === idx) {
					connected.push(to);
				}
				else if(to === idx) {
					connected.push(from);
				}
			}

			// Add triangles and polyhedra
			if(this.countConstrain(connected.length)) {

				islands.push(connected);

				if(this.colorByCenterAtom) {
					const {atomZ} = this.structure!.atoms[idx];
					this.centerAtomsColor.push(getAtomData(atomZ).color);
				}
			}
		}

		// Convert atom indexes to list of coordinates
		const out: number[][] = [];
		for(const island of islands) {

			const oneIsland: number[] = [];
			for(const atomIdx of island) {
				const {position} = atoms[atomIdx];
				oneIsland.push(position[0], position[1], position[2]);
			}
			out.push(oneIsland);
		}
		return out;
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			color: this.color,
			labelKind: this.labelKind,
			atomsSelector: this.atomsSelector,
			showPolyhedra: this.showPolyhedra,
			colorByCenterAtom: this.colorByCenterAtom,
			opacityByCenterAtom: this.opacityByCenterAtom,
		};
	}

	/**
	 * Channel handler for the change of visible characteristics
	 *
	 * @param params - Parameters from the client
	 */
	private channelLook(params: CtrlParams): void {

		this.color = params.color as string ?? "#FFFFFF80";
		this.showPolyhedra = params.showPolyhedra as boolean ?? true;
		this.colorByCenterAtom = params.colorByCenterAtom as boolean ?? true;
		this.opacityByCenterAtom = params.opacityByCenterAtom as number ?? 0.5;
	}

	/**
	 * Channel handler for the change of center atoms
	 *
	 * @param params - Parameters from the client
	 */
	private channelSelect(params: CtrlParams): CtrlParams {

		this.labelKind = params.labelKind as SelectorType ?? "symbol";
		this.atomsSelector = params.atomsSelector as string ?? "";

		// Check the selection string
		if(!this.structure) return {status: "none"};
		const status = checkAtomsSelector(this.structure, this.labelKind, this.atomsSelector);
		if(status) return {error: status};

		// Extract the polyhedrons vertices and send to client
		const islands = this.createVerticeLists();

		sendPolyhedraToClient(this.id, "vertices", islands, this.centerAtomsColor);
		return {status: "ok"};
	}

	/**
	 * Channel handler for the change of constrains on the number of atoms
	 *
	 * @param params - Parameters from the client
	 */
	private channelConstrain(params: CtrlParams): void {

        this.constrainVertices = params.constrainVertices as string ?? "any";
        this.countVertices = params.countVertices as number ?? 3;

		// Extract the polyhedrons vertices and send to client
		if(!this.structure) return;
		const islands = this.createVerticeLists();

		sendPolyhedraToClient(this.id, "vertices", islands, this.centerAtomsColor);
	}
}
