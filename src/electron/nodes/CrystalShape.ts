/**
 * Compute and visualize the crystal shape for a given structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-06-09
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
import {hasNoUnitCell} from "../modules/Helpers";
import {computeCrystalShape} from "../shapes/ComputeCrystalShape";
import {buildCrystalShape} from "../shapes/BuildCrystal";
import type {ChannelDefinition, CtrlParams, Structure} from "@/types";


export class CrystalShape extends NodeCore {

	private structure: Structure | undefined;

	// Mirror of the UI reactive state
	private readonly state = {
		allPlanes: false,
		maxPlanesCount: 100
	};

	private readonly channels: ChannelDefinition[] = [
		{name: "init",			type: "invoke",	    callback: this.channelInit.bind(this)},
		{name: "state",			type: "send",	  	callback: this.channelState.bind(this)},
		{name: "compute",		type: "invoke",	    callback: this.channelCompute.bind(this)},
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
		return "Visualize the shape of the crystal structure.";
	}

	override fromPreviousNode(data: Structure): void {

		if(!data?.atoms.length) {

			this.structure = undefined;
			return;
		}
		this.structure = data;
	}

	// > Load/save status
	saveStatus(): string {

		return `"${this.id}": ${JSON.stringify(this.state)}`;
	}

	private initializeState(params: CtrlParams): void {

        this.state.allPlanes = params.allPlanes as boolean ?? false;
        this.state.maxPlanesCount = params.maxPlanesCount as number ?? 100;
	}

	loadStatus(params: CtrlParams): void {

		this.initializeState(params);
	}

	// > Channels
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return this.state;
	}

	/**
	 * Channel handler for saving the UI status
	 */
	private channelState(params: CtrlParams): void {

		// Save the full state
		this.initializeState(params);
	}

	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelCompute(): CtrlParams {

		if(!this.structure) return {status: "Do nothing"};

		const {basis} = this.structure.crystal;

		// Should have the unit cell
		if(hasNoUnitCell(basis)) {

			return {error: "Missing unit cell in input to compute crystal shape"};
		}

		// Do the computation
		try {

			const planes = computeCrystalShape(this.structure);

			const maxPlanes = this.state.allPlanes ? 0 : this.state.maxPlanesCount;
			buildCrystalShape(basis, planes, maxPlanes);
		}
		catch(error) {
			return {error: (error as Error).message};
		}

		return {status: "Success"};
	}
}
