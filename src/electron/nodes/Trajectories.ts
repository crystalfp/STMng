/**
 * Draw atom trajectories as lines or as position clouds.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-09
 */
import {ipcMain} from "electron";
import {NodeCore} from "../modules/NodeCore";
import {selectAtomsByKind, type SelectorType} from "../modules/AtomsChooser";
import {getAtomData} from "../modules/AtomData";
import {sendToClient, sendTracesToClient} from "../modules/ToClient";
import {createSecondaryWindow, isSecondaryWindowOpen,
		sendToSecondaryWindow} from "../modules/WindowsUtilities";
import type {Structure, CtrlParams, ChannelDefinition, MeanDisplacement} from "@/types";
import {ReorderAtomsInSteps} from "../modules/ReorderAtomsInSteps";

export class Trajectories extends NodeCore {

	private structure: Structure | undefined;
	private showTrajectories = false;
	private createTrajectories = false;
	private labelKind: SelectorType = "symbol";
	private atomsSelector = "";
	private maxDisplacement = 1;
	private showPositionClouds = false;
	private readonly traces: number[][] = [];
	private readonly tracesColor: string[] = [];
	private nextSteps = false;
	private positionCloudsColor = "#BBBBBE";
	private positionCloudsSize = 100;
	private readonly meanDisplacement: MeanDisplacement[] = [];
	private indices: number[] = [];
	private static channelOpened = false;
	private showMarker = false;
	private sizeMarkers = 1;
	private disentangler = new ReorderAtomsInSteps();


	private readonly channels: ChannelDefinition[] = [
		{name: "init",      type: "invoke", callback: this.channelInit.bind(this)},
		{name: "reset",     type: "send",   callback: this.channelReset.bind(this)},
		{name: "run",		type: "send",   callback: this.channelRun.bind(this)},
		{name: "select",	type: "send",   callback: this.channelSelect.bind(this)},
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

	override fromPreviousNode(data: Structure): void {

		if(!data) return;
		this.structure = data;
		if(this.createTrajectories || isSecondaryWindowOpen("/displacements")) {

			const {atoms} = this.structure;

			this.indices = selectAtomsByKind(this.structure, this.labelKind, this.atomsSelector);

			const len = this.indices.length;
			if(this.nextSteps) {
				// After the first step increase the points size
				// if the number of atoms traced increases
				if(len > this.traces.length) {
					const previousLength = this.traces.length;
					this.traces.length = len;
					for(let i=previousLength; i < len; ++i) this.traces[i] = [];
				}
			}
			else {

				this.nextSteps = true;

				// First step, initialize set of coordinates
				this.traces.length = len;
				for(let i=0; i < len; ++i) this.traces[i] = [];
			}

			// Record coordinates
			let trajectoryIndex = 0;
			for(const idx of this.indices) {

				const {position} = atoms[idx];

				this.traces[trajectoryIndex].push(position[0], position[1], position[2]);
				++trajectoryIndex;
			}

			// Create lines
			if(this.createTrajectories) {
				Trajectories.setTraceColor(this.structure, this.indices, this.tracesColor);
				this.sendLines(this.indices.length);
			}

			this.sendMeanDisplacement(this.indices);
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
			positionCloudsColor: this.positionCloudsColor,
			positionCloudsSize: this.positionCloudsSize,
			showMarker: this.showMarker,
			sizeMarkers: this.sizeMarkers
		};
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		this.showTrajectories    = params.showTrajectories as boolean ?? false;
		this.labelKind           = params.labelKind as SelectorType ?? "symbol";
		this.atomsSelector       = params.atomsSelector as string ?? "";
		this.maxDisplacement     = params.maxDisplacement as number ?? 1;
		this.showPositionClouds  = params.showPositionClouds as boolean ?? false;
		this.positionCloudsColor = params.positionCloudsColor as string ?? "#BBBBBE";
		this.positionCloudsSize  = params.positionCloudsSize as number ?? 100;
		this.showMarker 		 = params.showMarker as boolean ?? false;
		this.sizeMarkers 		 = params.sizeMarkers as number ?? 1;
	}

	// > Trace lines methods
	/**
	 * Draw trajectory lines (split in segments to avoid big jumps)
	 */
	private sendLines(atomsCount: number): void {

		const segments: number[][] = [];
		const colors: string[] = [];
		for(let i=0; i < atomsCount; ++i) {
			const splitTrace: number[][] = [];
			Trajectories.splitSegments(this.traces[i], this.maxDisplacement, splitTrace);
			for(const trace of splitTrace) {
				segments.push(trace);
				colors.push(this.tracesColor[i]);
			}
		}
		sendTracesToClient(this.id, "traces", segments, colors);
	}

	/**
	 * Split a trajectory in segments with steps' lengths less than a maximum
	 *
	 * @param points - Points along a path
	 * @param maxLength - Max length of each segment
	 * @returns An array of segments points
	 */
	private static splitSegments(points: number[], maxLength: number, segments: number[][]): void {

		// Sanity check
		const npoints = points.length/3;
		if(npoints < 2) return;

		let segmentStartIndex = 0;
		for(let i=1; i < npoints; ++i) {

			// Compute segment length
			const j = i*3;
			const k = (i-1)*3;
			const dx = points[j]   - points[k];
			const dy = points[j+1] - points[k+1];
			const dz = points[j+2] - points[k+2];
			const length = Math.hypot(dx, dy, dz);

			if(length > maxLength) {

				// Finish previous segment
				if((j-segmentStartIndex) > 1) {
					segments.push(points.slice(segmentStartIndex, j));
				}

				// Start new segment
				segmentStartIndex = j;
			}
		}

		// Output last segment
		if((npoints*3 - segmentStartIndex) > 1) {
			segments.push(points.slice(segmentStartIndex));
		}
	}

	/**
	 * Extract the trace colors as the atom type color
	 *
	 * @param structure - The structure
	 * @param indices - Indices of the selected atoms
	 * @param traceColor - The resulting colors
	 */
	private static setTraceColor(structure: Structure,
						  		 indices: number[],
						  		 traceColor: string[]): void {

		const len = indices.length;
		traceColor.length = len;
		const {atoms} = structure;
		let i = 0;
		for(const idx of indices) {
			const {atomZ} = atoms[idx];
			traceColor[i++] = getAtomData(atomZ).color;
		}
	}

	/**
	 * Compute mean positions and displacements
	 *
	 * @param indices - Indices of selected atoms
	 */
	private computeMeanPositionAndDisplacement(indices: number[]): void {

		this.meanDisplacement.length = 0;
		if(indices.length === 0) return;

		// Compute average position and displacement
		const averageResults = this.disentangler.loadStep(this.structure!, indices);

		for(const avg of averageResults) {

			this.meanDisplacement.push({
				index: avg.index,
				atomType: avg.atomType,
				meanX: avg.position[0],
				meanY: avg.position[1],
				meanZ: avg.position[2],
				displacement: avg.displacement
			});
		}

		/*
		// const {atoms} = this.structure!;
		const currentTraces: number[][] = [];
		for(const trace of this.traces) {
			currentTraces.push(trace);
		}

		if(this.hasUnitCell) {

			for(let i=0; i < currentTraces.length; ++i) {

				const trace = currentTraces[i];

				let lastX = trace[0];
				let lastY = trace[1];
				let lastZ = trace[2];

				// eslint-disable-next-line sonarjs/no-redundant-assignments
				for(let j=3; j < trace.length; j+=3) {

					const dx = trace[j]   - lastX;
					const dy = trace[j+1] - lastY;
					const dz = trace[j+2] - lastZ;
					const length = Math.hypot(dx, dy, dz);
					if(length > this.maxDisplacement) {
						currentTraces[i] = this.removeJumps(trace, j);
						break;
					}
					lastX = trace[j];
					lastY = trace[j+1];
					lastZ = trace[j+2];
				}
			}
		}

		for(let i=0; i < indices.length; ++i) {

			const idx = indices[i];
			const trace = currentTraces[i];

			// Compute mean position
			let meanX = 0;
			let meanY = 0;
			let meanZ = 0;
			let steps = 0;

			for(let j=0; j < trace.length; j+=3) {
				meanX += trace[j];
				meanY += trace[j+1];
				meanZ += trace[j+2];
				++steps;
			}

			meanX /= steps;
			meanY /= steps;
			meanZ /= steps;

			// Compute displacement
			let displacement = 0;
			for(let j=0; j < trace.length; j+=3) {

				const dx = trace[j]   - meanX;
				const dy = trace[j+1] - meanY;
				const dz = trace[j+2] - meanZ;
				displacement += dx*dx+dy*dy+dz*dz;
			}
			displacement /= steps;

			// Send results
			const {atomZ} = atoms[idx];
			const atomType = getAtomData(atomZ).symbol;

			this.meanDisplacement.push({
				index: idx,
				atomType,
				meanX,
				meanY,
				meanZ,
				displacement
			});
		}
			*/
	}

	/**
	 * Compute and send updated mean positions and displacements to client
	 *
	 * @param indices - Indices of selected atoms
	 */
	private sendMeanDisplacement(indices: number[]): void {

		if(isSecondaryWindowOpen("/displacements")) {

			// Compute mean position and displacement
			this.computeMeanPositionAndDisplacement(indices);

			const dataToSend = JSON.stringify(this.meanDisplacement);
			sendToSecondaryWindow("/displacements", dataToSend);
			this.sendMarkers(this.showMarker, this.sizeMarkers, this.meanDisplacement);
		}
	}

	/**
	 * Send markers to the viewer
	 *
	 * @param showMarker - If the marker should be visible
	 * @param sizeMarkers - Size of the marker
	 * @param meanDisplacement - Positions of the markers and other info
	 */
	private sendMarkers(showMarker: boolean,
					    sizeMarkers: number,
						meanDisplacement: MeanDisplacement[]): void {

		const positions = [];
		if(showMarker) {
			for(const entry of meanDisplacement) {
				positions.push(entry.meanX, entry.meanY, entry.meanZ);
			}
		}
		sendToClient(this.id, "set-markers", {
			showMarker,
			sizeMarkers,
			positions
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
			showTrajectories: this.showTrajectories,
			labelKind: this.labelKind,
			atomsSelector: this.atomsSelector,
			maxDisplacement: this.maxDisplacement,
			showPositionClouds: this.showPositionClouds,
			positionCloudsColor: this.positionCloudsColor,
			positionCloudsSize: this.positionCloudsSize
		};
	}

	/**
	 * Channel handler for clearing the trajectories
	 */
	private channelReset(): void {

		this.traces.length = 0;
		this.tracesColor.length = 0;
		this.nextSteps = false;
		this.meanDisplacement.length = 0;
		this.showMarker = false;
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
			this.disentangler.loadStep(this.structure, this.indices);
		}
	}

	/**
	 * Channel handler for select atoms to trace
	 *
	 * @param params - Parameters from the client
	 */
	private channelSelect(params: CtrlParams): void {

        this.labelKind     = params.labelKind as SelectorType ?? "symbol";
        this.atomsSelector = params.atomsSelector as string ?? "";

		this.channelReset();
	}

	/**
	 * Channel handler for max displacement changes
	 *
	 * @param params - Parameters from the client
	 */
	private channelGap(params: CtrlParams): void {

        this.maxDisplacement = params.maxDisplacement as number ?? 1;

		// Create lines
		this.sendLines(this.traces.length);
	}

	/**
	 * Channel handler for position clouds
	 *
	 * @param params - Parameters from the client
	 */
	private channelClouds(params: CtrlParams): void {

	    this.showPositionClouds  = params.showPositionClouds as boolean ?? false;
        this.positionCloudsSize  = params.positionCloudsSize as number ?? 100;
        this.positionCloudsColor = params.positionCloudsColor as string ?? "#BBBBBE";
	}

	/**
	 * Channel handler for displaying mean positions and displacements dialog
	 */
	private channelMeans(): void {

		// Compute mean position and displacement
		this.computeMeanPositionAndDisplacement(this.indices);

		const dataToSend = JSON.stringify(this.meanDisplacement);

		if(isSecondaryWindowOpen("/displacements")) {

			sendToSecondaryWindow("/displacements", dataToSend);
		}
		else {
			createSecondaryWindow({
				routerPath: "/displacements",
				width: 670,
				height: 400,
				title: "Show mean positions and displacements",
				data: dataToSend
			});
		}

		// If channel not already opened, open it
		if(Trajectories.channelOpened) return;
		Trajectories.channelOpened = true;

		ipcMain.on("SYSTEM:show-markers", (_event, params: CtrlParams) => {

			this.showMarker = params.visible as boolean ?? false;
			this.sizeMarkers = params.size as number ?? 1;
			this.sendMarkers(this.showMarker, this.sizeMarkers, this.meanDisplacement);
		});
	}
}
