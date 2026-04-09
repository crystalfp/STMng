/**
 * Draw atom trajectories as lines or as position clouds.
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
import {checkAtomsSelector, selectAtomsByKind, type SelectorType} from "../modules/AtomsChooser";
import {getAtomData} from "../modules/AtomData";
import {sendSegmentsToClient} from "../modules/ToClient";
import {createOrUpdateSecondaryWindow, isSecondaryWindowOpen,
		sendToSecondaryWindow} from "../modules/WindowsUtilities";
import {ReorderAtomsInSteps} from "../modules/ReorderAtomsInSteps";
import type {Structure, CtrlParams, ChannelDefinition, PositionType} from "@/types";

export class Trajectories extends NodeCore {

	private structure: Structure | undefined;
	private showTrajectories = false;
	private createTrajectories = false;
	private labelKind: SelectorType = "symbol";
	private atomsSelector = "";
	private maxDisplacement = 1;
	private showPositionClouds = false;
	private nextSteps = false;
	private positionCloudsSize = 100;
	private indices: number[] = [];
	private readonly disentangler = new ReorderAtomsInSteps();

	private readonly segments: PositionType[][] = [];
	private readonly segmentsColor: string[] = [];
	private readonly segmentsSkip: boolean[] = [];

	private readonly channels: ChannelDefinition[] = [
		{name: "init",      type: "invoke", callback: this.channelInit.bind(this)},
		{name: "reset",     type: "send",   callback: this.channelReset.bind(this)},
		{name: "run",		type: "send",   callback: this.channelRun.bind(this)},
		{name: "select",	type: "invoke", callback: this.channelSelect.bind(this)},
		{name: "gap",		type: "send",   callback: this.channelGap.bind(this)},
		{name: "clouds",	type: "send",   callback: this.channelClouds.bind(this)},
		{name: "means",  	type: "send",   callback: this.channelMeans.bind(this)},
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
		return "Draw selected atoms trajectories in a sequence of steps as lines or cloud. Computes also a summary of mean displacements";
	}

	override fromPreviousNode(data: Structure): void {

		if(!data) return;
		this.structure = data;
		if(this.createTrajectories || isSecondaryWindowOpen("/displacements")) {

			const {atoms} = this.structure;

			this.indices = selectAtomsByKind(this.structure, this.labelKind, this.atomsSelector);

			const len = this.indices.length;

			// Safety check
			if(atoms.length < len) return;

			if(this.nextSteps) {

				// Complete the pair of points that characterize each segment
				for(let i=0; i < len; ++i) {

					const idx = this.indices[i];
					const {position} = atoms[idx];
					if(this.segments[i].length === 1) {
						this.segments[i].push([position[0], position[1], position[2]]);
					}
					else {
						const p2 = this.segments[i][1];
						this.segments[i][0] = [p2[0], p2[1], p2[2]];
						this.segments[i][1] = [position[0], position[1], position[2]];
					}
					this.segmentsSkip[i] = false;
				}

				// After the first step increase the points size
				// if the number of atoms traced increases
				const previousLength = this.segments.length;
				if(len > previousLength) {

					this.segments.length = len;
					this.segmentsColor.length = len;
					this.segmentsSkip.length = len;
					for(let i=previousLength; i < len; ++i) {
						const idx = this.indices[i];
						const {atomZ, position} = atoms[idx];
						this.segments[i] = [[position[0], position[1], position[2]]];
						this.segmentsColor[i] = getAtomData(atomZ).color;
						this.segmentsSkip[i] = true;
					}
				}
			}
			else {

				this.nextSteps = true;

				// First step, initialize the set of coordinates
				this.segments.length = len;
				this.segmentsColor.length = len;
				this.segmentsSkip.length = len;
				for(let i=0; i < len; ++i) {

					const idx = this.indices[i];
					const {atomZ, position} = atoms[idx];
					this.segments[i] = [[position[0], position[1], position[2]]];
					this.segmentsColor[i] = getAtomData(atomZ).color;
					this.segmentsSkip[i] = true;
				}
			}

			// Create lines
			if(this.createTrajectories) {
				this.markJumps(this.maxDisplacement);
				sendSegmentsToClient(this.id,
								     this.segments,
								     this.segmentsColor,
								     this.segmentsSkip);
			}

			this.sendMeanDisplacement(this.indices);
		}
	}

	/**
	 * Mark too big segments
	 *
	 * @param maxLength - Max length of a jump before marking it as to be skipped
	 */
	private markJumps(maxLength: number): void {

		const len =	this.segments.length;
		for(let i=0; i < len; ++i) {

			if(this.segments[i].length < 2) continue;

			const [p0, p1] = this.segments[i];

			// Compute segment length
			const dx = p1[0] - p0[0];
			const dy = p1[1] - p0[1];
			const dz = p1[2] - p0[2];
			const length = Math.hypot(dx, dy, dz);

			this.segmentsSkip[i] = length > maxLength;
		}
	}

	// > Load/save status
	saveStatus(): string {
        const statusToSave = {
			showTrajectories: this.showTrajectories,
			labelKind: this.labelKind,
			atomsSelector: this.atomsSelector,
			maxDisplacement: this.maxDisplacement,
			showPositionClouds: this.showPositionClouds,
			positionCloudsSize: this.positionCloudsSize,
		};
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		this.showTrajectories    = params.showTrajectories as boolean ?? false;
		this.labelKind           = params.labelKind as SelectorType ?? "symbol";
		this.atomsSelector       = params.atomsSelector as string ?? "";
		this.maxDisplacement     = params.maxDisplacement as number ?? 1;
		this.showPositionClouds  = params.showPositionClouds as boolean ?? false;
		this.positionCloudsSize  = params.positionCloudsSize as number ?? 100;
	}

	/**
	 * Compute and send updated mean positions and displacements to client
	 *
	 * @param indices - Indices of selected atoms
	 */
	private sendMeanDisplacement(indices: number[]): void {

		// Compute average position and displacement
		const averageResults = this.disentangler.loadStep(this.structure!, indices);

		if(isSecondaryWindowOpen("/displacements")) {

			const dataToSend = JSON.stringify(averageResults.averages);
			sendToSecondaryWindow("/displacements", {means: dataToSend});
		}

		this.toNextNode(averageResults.structure);
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			showTrajectories: this.showTrajectories,
			labelKind: this.labelKind,
			atomsSelector: this.atomsSelector,
			maxDisplacement: this.maxDisplacement,
			showPositionClouds: this.showPositionClouds,
			positionCloudsSize: this.positionCloudsSize
		};
	}

	/**
	 * Channel handler for clearing the trajectories
	 */
	private channelReset(): void {

		this.segments.length = 0;
		this.segmentsColor.length = 0;
		this.segmentsSkip.length = 0;
		this.nextSteps = false;
		this.sendMeanDisplacement([]);
		this.disentangler.init();
	}

	/**
	 * Channel handler for start trajectory tracing
	 *
	 * @param params - Parameters from the client
	 */
	private channelRun(params: CtrlParams): void {

		this.createTrajectories = params.createTrajectories as boolean ?? false;

		if(this.createTrajectories && this.structure && isSecondaryWindowOpen("/displacements")) {

			this.indices = selectAtomsByKind(this.structure, this.labelKind, this.atomsSelector);
			const averageResults = this.disentangler.loadStep(this.structure, this.indices);

			const dataToSend = JSON.stringify(averageResults.averages);
			sendToSecondaryWindow("/displacements", {means: dataToSend});

			this.toNextNode(averageResults.structure);
		}
	}

	/**
	 * Channel handler for select atoms to trace
	 *
	 * @param params - Parameters from the client
	 */
	private channelSelect(params: CtrlParams): CtrlParams {

        this.labelKind     = params.labelKind as SelectorType ?? "symbol";
        this.atomsSelector = params.atomsSelector as string ?? "";

		// Check the selection string
		if(!this.structure) return {status: "none"};
		const status = checkAtomsSelector(this.structure, this.labelKind, this.atomsSelector);
		if(status) return {error: status};

		this.channelReset();

		return {status: "ok"};
	}

	/**
	 * Channel handler for max displacement changes
	 *
	 * @param params - Parameters from the client
	 */
	private channelGap(params: CtrlParams): void {

        this.maxDisplacement = params.maxDisplacement as number ?? 1;
	}

	/**
	 * Channel handler for position clouds
	 *
	 * @param params - Parameters from the client
	 */
	private channelClouds(params: CtrlParams): void {

	    this.showPositionClouds  = params.showPositionClouds as boolean ?? false;
        this.positionCloudsSize  = params.positionCloudsSize as number ?? 100;
	}

	/**
	 * Channel handler for displaying mean positions and displacements dialog
	 */
	private channelMeans(): void {

		// Compute average position and displacement
		const averageResults = this.disentangler.loadStep(this.structure!, this.indices);

		const dataToSend = JSON.stringify(averageResults.averages);

		createOrUpdateSecondaryWindow({
			routerPath: "/displacements",
			width: 670,
			height: 400,
			title: "Show mean positions and displacements",
			data: {means: dataToSend},
			alwaysOnTop: true
		});

		this.toNextNode(averageResults.structure);
	}
}
