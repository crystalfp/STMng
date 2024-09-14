/**
 * Draw atom trajectories as lines or as position clouds.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import {NodeCore} from "../modules/NodeCore";
import {selectAtomsByKind, type SelectorType} from "../modules/SelectAtoms";
import {getAtomData} from "../modules/AtomData";
import {sendTracesToClient, sendPositionCloudsToClient} from "../modules/WindowsUtilities";
import type {Structure, PositionType, BasisType,
			 UiInfo, CtrlParams, ChannelDefinition} from "../../types";

export class Trajectories extends NodeCore {

	protected readonly name = "Trajectories";
	private structure: Structure | undefined;
	private showTrajectories = false;
	private createTrajectories = false;
	private labelKind: SelectorType = "symbol";
	private atomsSelector = "";
	private maxDisplacement = 1;
	private showPositionClouds = false;
	private positionCloudsSideExp = 5;
	private positionCloudsGrow = 0.1;
	private positionCloudsSide = 2**this.positionCloudsSideExp;
	private readonly traces: number[][] = [];
	private readonly tracesColor: string[] = [];
	private nextSteps = false;
	private positionCloud: number[] | undefined;
	private positionLimits: number[] = [];
	private maxCount = 0;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",      type: "invoke", callback: this.channelInit.bind(this)},
		{name: "reset",     type: "send",   callback: this.channelReset.bind(this)},
		{name: "run",		type: "send",   callback: this.channelRun.bind(this)},
		{name: "select",	type: "send",   callback: this.channelSelect.bind(this)},
		{name: "gap",		type: "send",   callback: this.channelGap.bind(this)},
		{name: "clouds",	type: "send",   callback: this.channelClouds.bind(this)},
	];

	constructor(private readonly id: string) {

		super();
		this.setupChannels(this.id, this.channels);
	}

	override notifier(data: Structure): void {

		this.structure = data;
		if(!this.structure) return;
		if(this.createTrajectories) {

			const {atoms, crystal} = this.structure;

			const indices = selectAtomsByKind(this.structure, this.labelKind, this.atomsSelector);

			this.setTraceColor(this.structure, indices, this.tracesColor);

			const len = indices.length;
			if(this.nextSteps) {
				// After the first step increase the points size if the number of atoms traced increases
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

				// Create an empty positions cloud volume
				if(this.showPositionClouds) {

					const {origin, basis} = crystal;
					this.computeLimits(origin, basis);
					this.positionCloud = Array<number>(this.positionCloudsSide*
													   this.positionCloudsSide*
													   this.positionCloudsSide).fill(0);
				}
			}

			// Record coordinates
			let trajectoryIndex = 0;
			for(const idx of indices) {

				const {position} = atoms[idx];

				this.traces[trajectoryIndex].push(position[0], position[1], position[2]);
				++trajectoryIndex;
				if(this.showPositionClouds && this.positionCloud) {
					this.accumulatePosition(position[0], position[1], position[2]);
				}
			}

			// Create lines
			this.sendLines(indices.length);

			// Create volume
			if(this.showPositionClouds) {
				sendPositionCloudsToClient(this.id, "volume",
										   this.positionCloud!,
										   this.positionLimits,
										   this.maxCount);
			}
		}
	}

	saveStatus(): string {
        const statusToSave = {
			showTrajectories: this.showTrajectories,
			labelKind: this.labelKind,
			atomsSelector: this.atomsSelector,
			maxDisplacement: this.maxDisplacement,
			showPositionClouds: this.showPositionClouds,
			positionCloudsSideExp: this.positionCloudsSideExp,
			positionCloudsGrow: this.positionCloudsGrow,
		};
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		this.showTrajectories      = params.showTrajectories as boolean ?? false;
		this.labelKind             = params.labelKind as SelectorType ?? "symbol";
		this.atomsSelector         = params.atomsSelector as string ?? "";
		this.maxDisplacement       = params.maxDisplacement as number ?? 1;
		this.showPositionClouds    = params.showPositionClouds as boolean ?? false;
		this.positionCloudsSideExp = params.positionCloudsSideExp as number ?? 5;
    	this.positionCloudsGrow    = params.positionCloudsGrow as number ?? 0.1;
	}

	getUiInfo(): UiInfo {
		return {
			id: this.id,
			ui: "TrajectoriesCtrl",
			graphic: "out",
			channels: this.channels.map((channel) => channel.name)
		};
	}

	/**
	 * Draw trajectory lines (split in segments to avoid big jumps)
	 */
	private sendLines(atomsCount: number): void {

		const segments: number[][] = [];
		const colors: string[] = [];
		for(let i=0; i < atomsCount; ++i) {
			const splitTrace: number[][] = [];
			this.splitSegments(this.traces[i], this.maxDisplacement, splitTrace);
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
	private splitSegments(points: number[], maxLength: number, segments: number[][]): void {

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
	private setTraceColor(structure: Structure,
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

	// > Position clouds methods
	/**
	 * Record a new position in the position cloud volume
	 *
	 * @param x - Position X for the atom
	 * @param y - Position Y for the atom
	 * @param z - Position Z for the atom
	 */
	private accumulatePosition(x: number, y: number, z: number): void {

		const ix = Math.floor(this.positionCloudsSide*(x-this.positionLimits[0])/this.positionLimits[3]);
		const iy = Math.floor(this.positionCloudsSide*(y-this.positionLimits[1])/this.positionLimits[4]);
		const iz = Math.floor(this.positionCloudsSide*(z-this.positionLimits[2])/this.positionLimits[5]);

		const max = ++this.positionCloud![ix+this.positionCloudsSide*(iy+this.positionCloudsSide*iz)];
		if(max > this.maxCount) this.maxCount = max;
	}

	/**
	 * Compute the limits for the volume enclosing the unit cell
	 *
	 * @param orig - Unit cell origin
	 * @param basis - Unit cell basis
	 */
	private computeLimits(orig: PositionType, basis: BasisType): void {

		if(basis.every((value) => value === 0)) return;

		const vv: number[] = [
/* 0 */ orig[0],                            orig[1],                            orig[2],
/* 1 */ orig[0]+basis[0],                   orig[1]+basis[1],                   orig[2]+basis[2],
/* 2 */ orig[0]+basis[0]+basis[3],          orig[1]+basis[1]+basis[4],          orig[2]+basis[2]+basis[5],
/* 3 */ orig[0]+basis[3],                   orig[1]+basis[4],                   orig[2]+basis[5],
/* 4 */ orig[0]+basis[6],                   orig[1]+basis[7],                   orig[2]+basis[8],
/* 5 */ orig[0]+basis[0]+basis[6],          orig[1]+basis[1]+basis[7],          orig[2]+basis[2]+basis[8],
/* 6 */ orig[0]+basis[0]+basis[3]+basis[6], orig[1]+basis[1]+basis[4]+basis[7], orig[2]+basis[2]+basis[5]+basis[8],
/* 7 */ orig[0]+basis[3]+basis[6],          orig[1]+basis[4]+basis[7],          orig[2]+basis[5]+basis[8],
		];

		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let minZ = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		let maxZ = Number.NEGATIVE_INFINITY;
		for(let i=0; i < 8; ++i) {
			const j = 3*i;
			if(vv[j] > maxX)   maxX = vv[j];
			if(vv[j+1] > maxY) maxY = vv[j+1];
			if(vv[j+2] > maxZ) maxZ = vv[j+2];
			if(vv[j] < minX)   minX = vv[j];
			if(vv[j+1] < minY) minY = vv[j+1];
			if(vv[j+2] < minZ) minZ = vv[j+2];
		}

		const growHalf = this.positionCloudsGrow/2;
		const growPlus1 = 1+this.positionCloudsGrow;
		const sideX = maxX-minX;
		const sideY = maxY-minY;
		const sideZ = maxZ-minZ;

		this.positionLimits = [
			minX-sideX*growHalf,	// Volume origin
			minY-sideY*growHalf,
			minZ-sideZ*growHalf,
			sideX*growPlus1,		// Volume sides
			sideY*growPlus1,
			sideZ*growPlus1,
		];
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
			positionCloudsSideExp: this.positionCloudsSideExp,
			positionCloudsGrow: this.positionCloudsGrow,
		};
	}

	/**
	 * Channel handler for clearing the trajectories
	 */
	private channelReset(): void {

		this.traces.length = 0;
		this.tracesColor.length = 0;
		this.nextSteps = false;

		if(this.positionCloud) this.positionCloud.fill(0);
	}

	/**
	 * Channel handler for start trajectory tracing
	 *
	 * @param params - Parameters from the client
	 */
	private channelRun(params: CtrlParams): void {

		this.createTrajectories = params.createTrajectories as boolean ?? false;
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

	    this.showPositionClouds    = params.showPositionClouds as boolean ?? false;
        this.positionCloudsSideExp = params.positionCloudsSideExp as number ?? 5;
		this.positionCloudsSide    = 2**this.positionCloudsSideExp;
        this.positionCloudsGrow    = params.positionCloudsGrow as number ?? 0.1;
	}
}
