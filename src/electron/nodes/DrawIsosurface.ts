/**
 * Compute one or more isosurfaces of the volumetric data.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-09
 */
import {NodeCore} from "../modules/NodeCore";
import {IsosurfaceCore} from "../modules/IsosurfaceCore";
import {sendIsosurfacesToClient} from "../modules/ToClient";
import {getValueLimits, hasNoUnitCell} from "../modules/Helpers";
import type {Structure, CtrlParams, ChannelDefinition} from "@/types";

export class DrawIsosurface extends NodeCore {

	private structure: Structure | undefined;

    private showIsosurface = false;
    private dataset = 0;
    private countDatasets = 0;
    private isoValue = 0;
    private range: [number, number] = [-10, 10];
    private colormapName = "rainbow";
    private opacity = 1;
    private nestedIsosurfaces = false;
    private countIsosurfaces = 2;
    private limitLow = -10;
    private limitHigh = 10;
    private limitColormap = false;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",      type: "invoke", callback: this.channelInit.bind(this)},
		{name: "change",    type: "send",   callback: this.channelChange.bind(this)},
		{name: "show",      type: "send",   callback: this.channelShow.bind(this)},
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

		this.structure = data;
		if(!this.structure?.volume) return;

		const countDatasets = this.structure.volume.length;
		if(countDatasets === 0) {
			this.countDatasets = 0;
			this.range = [-10, 10];
		}
		else {
			this.countDatasets = countDatasets;
			this.range = getValueLimits(this.structure, this.dataset);
		}

        this.isoValue = (this.range[0]+this.range[1])/2;
		this.limitLow = this.range[0];
		this.limitHigh = this.range[1];

		this.createIsosurface(true);
	}

	// > Load/save status
	saveStatus(): string {
        const statusToSave = {
            showIsosurface: this.showIsosurface,
            dataset: this.dataset,
            isoValue: this.isoValue,
            colormapName: this.colormapName,
            opacity: this.opacity,
            nestedIsosurfaces: this.nestedIsosurfaces,
            countIsosurfaces: this.countIsosurfaces,
            limitLow: this.limitLow,
            limitHigh: this.limitHigh,
            limitColormap: this.limitColormap,
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
        this.showIsosurface = params.showIsosurface as boolean ?? false;
        this.dataset = params.dataset as number ?? 0;
        this.isoValue = params.isoValue as number ?? 0;
        this.colormapName = params.colormapName as string ?? "rainbow";
        this.opacity = params.opacity as number ?? 1;

        this.nestedIsosurfaces = params.nestedIsosurfaces as boolean ?? false;
        this.countIsosurfaces = params.countIsosurfaces as number ?? 2;
        this.limitLow = params.limitLow as number ?? -10;
        this.limitHigh = params.limitHigh as number ?? 10;
        this.limitColormap = params.limitColormap as boolean ?? false;
	}

    /**
     * Create isosurfaces and return them to the rendering process
     *
     * @param changedStructure - True if isosurfaces are created by structure change
     */
	private createIsosurface(changedStructure: boolean): void {

        // Check if the isosurface could be created
        if(!this.structure?.volume ||
            this.structure.volume.length === 0 ||
            this.structure.volume[this.dataset]?.values.length === 0) {
                this.sendNoIsosurface();
                return;
        }

        // Access the needed values
        const {basis, origin} = this.structure.crystal;
        const {sides, values} = this.structure.volume[this.dataset];

        // A unit cell is needed to create the isosurface
        if(hasNoUnitCell(basis)) {
            this.sendNoIsosurface();
            return;
        }

        // Initialize the isosurface computation
        const iso = new IsosurfaceCore(sides, basis, origin, values);

		const indices: number[][] = [];
		const vertices: number[][] = [];
		const normals: number[][] = [];
		const isoValues: number[] = [];

        if(this.nestedIsosurfaces) {

            const delta = (this.limitHigh - this.limitLow) / (this.countIsosurfaces-1);
            let isoValue = this.limitLow;
            for(let i=0; i < this.countIsosurfaces; ++i) {

                iso.computeIsosurface(isoValue);

                // Copy results
                let len = iso.indices.length;
                indices[i] = Array<number>(len);
                for(let j=0; j < len; ++j) indices[i][j] = iso.indices[j];

                len = iso.vertices.length;
                vertices[i] = Array<number>(len);
                for(let j=0; j < len; ++j) vertices[i][j] = iso.vertices[j];

                len = iso.normals.length;
                normals[i] = Array<number>(len);
                for(let j=0; j < len; ++j) normals[i][j] = iso.normals[j];

                isoValues[i] = isoValue;

                // Next value
                isoValue += delta;
            }
        }
        else {
            // Compute the triangulated surface for a single value
            iso.computeIsosurface(this.isoValue);
            indices[0] = iso.indices;
            vertices[0] = iso.vertices;
            normals[0] = iso.normals;
            isoValues[0] = this.isoValue;
        }

		// Send the results to client
		sendIsosurfacesToClient(this.id, "iso", {
            indices,
            vertices,
            normals,
            isoValues,
			params: {
                changedStructure,
				countDatasets: this.countDatasets,
				valueMin: this.range[0],
				valueMax: this.range[1],
			}
		});
	}

    /**
     * Send to client no isosurface
     */
    private sendNoIsosurface(): void {

		sendIsosurfacesToClient(this.id, "iso", {
            indices: [],
            vertices: [],
            normals: [],
            isoValues: [],
			params: {}
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
            showIsosurface: this.showIsosurface,
            dataset: this.dataset,
            isoValue: this.isoValue,
            colormapName: this.colormapName,
            opacity: this.opacity,
            nestedIsosurfaces: this.nestedIsosurfaces,
            countIsosurfaces: this.countIsosurfaces,
            limitLow: this.limitLow,
            limitHigh: this.limitHigh,
            limitColormap: this.limitColormap,
		};
	}

	/**
	 * Channel handler for parameters change
     *
     * @param params - All parameters
	 */
	private channelChange(params: CtrlParams): void {

        this.dataset = params.dataset as number ?? 0;
        this.nestedIsosurfaces = params.nestedIsosurfaces as boolean ?? false;
        this.countIsosurfaces = params.countIsosurfaces as number ?? 2;
        this.limitLow = params.limitLow as number ?? -10;
        this.limitHigh = params.limitHigh as number ?? 10;
        this.isoValue = params.isoValue as number ?? 0;

        this.createIsosurface(false);
    }

	/**
	 * Channel handler for parameters change
     *
     * @param params - All parameters that do not need recomputation
	 */
	private channelShow(params: CtrlParams): void {

        this.colormapName = params.colormapName as string ?? "rainbow";
        this.showIsosurface = params.showIsosurface as boolean ?? false;
        this.limitColormap = params.limitColormap as boolean ?? false;
        this.opacity = params.opacity as number ?? 1;
    }
}
