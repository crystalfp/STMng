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
import {sendToClient} from "../modules/ToClient";
import {computeCrystalShape} from "../shapes/ComputeCrystalShape";
import {buildCrystalShape, type CrystalGeometry} from "../shapes/BuildCrystal";
import {createOrUpdateSecondaryWindow} from "../modules/WindowsUtilities";
import type {ChannelDefinition, CtrlParams, Structure} from "@/types";

export class CrystalShape extends NodeCore {

	private structure: Structure | undefined;
	private crystalResults: CrystalGeometry | undefined;
	private previousPlanesCount = -1;

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
		return "Visualize the shape of the crystal structure based on the Wulff theorem.";
	}

	override fromPreviousNode(data: Structure): void {

		this.crystalResults = undefined;

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
		this.previousPlanesCount = this.state.allPlanes ? 0 : this.state.maxPlanesCount;
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
		const currentPlanesCount = this.state.allPlanes ? 0 : this.state.maxPlanesCount;
		if(currentPlanesCount !== this.previousPlanesCount) {

			this.crystalResults = undefined;
			this.previousPlanesCount = currentPlanesCount;
		}
	}

	/**
	 * Channel handler for computing the crystal shape
	 *
	 * @returns Computation status
	 */
	private channelCompute(): CtrlParams {

		if(!this.structure) return {status: "Do nothing"};

		const {basis} = this.structure.crystal;

		// Should have the unit cell
		if(hasNoUnitCell(basis)) {

			return {error: "Missing unit cell in input to compute crystal shape"};
		}

		// Do the computation if data changes
		if(!this.crystalResults) {

			sendToClient(this.id, "step", {message: "Computing planes"});

			try {

				const planes = computeCrystalShape(this.structure);

				sendToClient(this.id, "step", {message: "Calculating intersections"});

				this.crystalResults = buildCrystalShape(basis, planes, this.previousPlanesCount,
					(message) => sendToClient(this.id, "step", {message})
				);
				if(!this.crystalResults ||
				   this.crystalResults.vertices.length === 0 ||
				   this.crystalResults.colors.length === 0) {
					throw Error("No result from building shape geometry");
				}
				sendToClient(this.id, "step", {message: ""});
			}
			catch(error) {
				sendToClient(this.id, "step", {message: ""});
				return {error: (error as Error).message};
			}

			// Orient triangles so their normals point to the outside
			this.crystalResults.index = this.orientSurfaces();
		}
		const dataToSend: CtrlParams = {
							vertices: this.crystalResults.vertices,
							colors: this.crystalResults.colors,
							maxColor: this.crystalResults.maxColor,
							index: this.crystalResults.index!,
							basis};

		// Open the chart
		createOrUpdateSecondaryWindow({
			routerPath: "/crystal-shape",
			width: 1000,
			height: 900,
			title: "Crystal shape",
			data: dataToSend
		});

		return {status: "Success"};
	}

	/**
	 * Orient triangles to have normals pointing outward
	 *
	 * @returns Index array of the triangle vertices
	 */
	private orientSurfaces(): number[] {

		const vert = this.crystalResults!.vertices;
		const n = vert.length;
		const index: number[] = [];

		// Find the crystal center
		let cx = 0;
		let cy = 0;
		let cz = 0;
		for(let i = 0; i < n; i += 3) {
			cx += vert[i];
			cy += vert[i+1];
			cz += vert[i+2];
		}
		cx /= n;
		cy /= n;
		cz /= n;

		// For each triangle
		for(let i=0, k=0; i < n; i += 9, k += 3) {

			// Find the vector from the crystal center
			const x0 = (vert[i]   + vert[i+3] + vert[i+6])/3-cx;
			const y0 = (vert[i+1] + vert[i+4] + vert[i+7])/3-cy;
			const z0 = (vert[i+2] + vert[i+5] + vert[i+8])/3-cz;

			// Find the triangle normal
			const ax = vert[i+3] - vert[i];
			const ay = vert[i+4] - vert[i+1];
			const az = vert[i+5] - vert[i+2];

			const bx = vert[i+6] - vert[i];
			const by = vert[i+7] - vert[i+1];
			const bz = vert[i+8] - vert[i+2];

			const nx = ay*bz - az*by;
			const ny = az*bx - ax*bz;
			const nz = ax*by - ay*bx;

			// Dot product is positive if both vectors
			// point in the same direction
			const dot = x0*nx + y0*ny + z0*nz;
			if(dot < 0) {

				index.push(k, k+2, k+1);
			}
			else {

				index.push(k, k+1, k+2);
			}
		}

		return index;
	}
}
