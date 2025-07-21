/**
 * Draw atom trajectories as lines or as position clouds.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-09
 */
import {NodeCore} from "../modules/NodeCore";
import {selectAtomsByKind, type SelectorType} from "../modules/AtomsChooser";
import {getAtomData} from "../modules/AtomData";
import {sendTracesToClient} from "../modules/ToClient";
import {createSecondaryWindow, isSecondaryWindowOpen,
		sendToSecondaryWindow} from "../modules/WindowsUtilities";
import type {Structure, CtrlParams, ChannelDefinition} from "@/types";
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
	private indices: number[] = [];
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
	 * Compute and send updated mean positions and displacements to client
	 *
	 * @param indices - Indices of selected atoms
	 */
	private sendMeanDisplacement(indices: number[]): void {

		// Compute average position and displacement
		const averageResults = this.disentangler.loadStep(this.structure!, indices);

		if(isSecondaryWindowOpen("/displacements")) {

			const dataToSend = JSON.stringify(averageResults.averages);
			sendToSecondaryWindow("/displacements", dataToSend);
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
			sendToSecondaryWindow("/displacements", dataToSend);

			this.toNextNode(averageResults.structure);
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

		// Compute average position and displacement
		const averageResults = this.disentangler.loadStep(this.structure!, this.indices);

		const dataToSend = JSON.stringify(averageResults.averages);

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

		this.toNextNode(averageResults.structure);
	}
}
