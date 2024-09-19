/**
 * Compute one or more isosurfaces of the volumetric data.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import {NodeCore} from "../modules/NodeCore";
import {IsosurfaceCore} from "../modules/IsosurfaceCore";
import {sendIsosurfacesToClient} from "../modules/WindowsUtilities";

import type {Structure, UiInfo, CtrlParams, ChannelDefinition} from "@/types";

export class DrawIsosurface extends NodeCore {

	private structure: Structure | undefined;

    private showIsosurface = false;
    private dataset = 0;
    private maxDataset = 0;
    private isoValue = 0;
    private range: [number, number] = [-10, 10];
    private colormapName = "rainbow";
    private opacity = 1;

    // private datasetPrevious = -1;
    // private isovaluePrevious = Number.NEGATIVE_INFINITY;
    // private countIsosurfacesPrevious = 0;
    // private limitLowPrevious = Number.NEGATIVE_INFINITY;
    // private limitHighPrevious = Number.POSITIVE_INFINITY;
    // private rangePrevious = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];

    private nestedIsosurfaces = false;
    private countIsosurfaces = 2;
    private limitLow = -10;
    private limitHigh = 10;
    private limitColormap = false;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",      type: "invoke", callback: this.channelInit.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	override notifier(data: Structure): void {

		this.structure = data;
		if(!this.structure?.volume) return;

		const countDatasets = this.structure.volume.length;
		if(countDatasets === 0) {
			this.dataset = 0;
			this.maxDataset = 0;
			this.range = [-10, 10];
			this.isoValue = 0;
		}
		else {
			if(this.dataset >= countDatasets) this.dataset = 0;
			this.maxDataset = countDatasets - 1;
			this.range = this.getValueLimits();
			this.isoValue = (this.range[0]+this.range[1])/2;
		}
		this.limitLow = this.range[0];
		this.limitHigh = this.range[1];

		this.createIsosurface();
	}

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

	getUiInfo(): UiInfo {
		return {
			id: this.id,
			ui: "DrawIsosurfaceCtrl",
			graphic: "out",
			channels: this.channels.map((channel) => channel.name)
		};
	}

	private createIsosurface(): void {
		// TBD
		void IsosurfaceCore;

		// Send the results to client
		sendIsosurfacesToClient(this.id, "iso", {
			params: {
				maxDataset: this.maxDataset,
				dataset: this.dataset,
				valueMin: this.range[0],
				valueMax: this.range[1],
			}
		});
	}

    /**
     * Get the volume value range for the colormap
     *
     * @returns [min volume value, max volume value]
     */
    private getValueLimits(): [number, number] {

        // Check if the plane should be created
        if(!this.structure?.volume) return [-10, 10];
        const {values} = this.structure.volume[this.dataset];
        if(values.length === 0) return [-10, 10];

        // Set the value range for the color map
        let minValue = Number.POSITIVE_INFINITY;
        let maxValue = Number.NEGATIVE_INFINITY;
        for(const value of values) {
            if(value < minValue) minValue = value;
            if(value > maxValue) maxValue = value;
        }

        return [minValue, maxValue];
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
}
