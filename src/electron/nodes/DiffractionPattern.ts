/**
 * Computes and display the X-Ray Diffraction pattern of a crystal structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-11-04
 */
import {NodeCore} from "../modules/NodeCore";
import {XRDCalculator, type DiffractionPatternResult} from "../modules/XRDCalculator";
import type {Structure, UiInfo, CtrlParams, ChannelDefinition,
			 ChartData, ChartOptions, ChartCoordinates} from "@/types";
import {createSecondaryWindow, isSecondaryWindowOpen,
		sendToClient, sendToSecondaryWindow} from "../modules/WindowsUtilities";


export class DiffractionPattern extends NodeCore {

	private structure: Structure | undefined;
	private scaled = true;
	private thetaLow = 0;
	private thetaHigh = 90;
	private width = 0.5;
	private wavelengthCode = "CuKa";
	private readonly xrd = new XRDCalculator();
	private xy: DiffractionPatternResult = {twoTheta: [], intensity: []};
	private readonly chartTitle = "X-Ray diffraction pattern";

	private readonly channels: ChannelDefinition[] = [
		{name: "init",    type: "invoke", callback: this.channelInit.bind(this)},
		{name: "show",    type: "send",   callback: this.channelShow.bind(this)},
		{name: "open",    type: "send",   callback: this.channelOpen.bind(this)},
		{name: "compute", type: "send",   callback: this.channelCompute.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	override fromPreviousNode(data: Structure): void {

		this.structure = data;
		const hasData = Boolean(data);

		// There is the structure so the XRD could be computed
		sendToClient(this.id, "enable", {enableComputation: hasData});

		if(hasData && isSecondaryWindowOpen(undefined, "/chart")) {

			// Compute spectra
			this.xy = this.xrd.getDiffractionPattern(this.structure, this.wavelengthCode, this.scaled,
													 this.thetaLow, this.thetaHigh);

			// Compute chart data
			const dataToSend = this.createDataForChart();

			// Update window
			sendToSecondaryWindow(undefined, {routerPath: "/chart", data: dataToSend});
		}
	}

	saveStatus(): string {
        const statusToSave = {
			scaled: this.scaled,
			thetaLow: this.thetaLow,
			thetaHigh: this.thetaHigh,
			width: this.width,
			wavelengthCode: this.wavelengthCode
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		this.scaled = params.scaled as boolean ?? true;
		this.thetaLow = params.thetaLow as number ?? 0;
		this.thetaHigh = params.thetaHigh as number ?? 90;
		this.width = params.width as number ?? 0.5;
		this.wavelengthCode = params.wavelengthCode as string ?? "CuKa";
	}

	getUiInfo(): UiInfo {
		return {
			id: this.id,
			ui: "DiffractionPatternCtrl",
			graphic: "none",
			channels: this.channels.map((channel) => channel.name)
		};
	}

	/**
	 * Create and pack the data for the chart viewer
	 *
	 * @returns JSON encoded chart data to be sent to the chart viewer
	 */
	private createDataForChart(): string {

		// Chart of the peaks
		// const coords: ChartCoordinates = [];
		// const len = this.xy.intensity.length;
		// for(let i=0; i < len; ++i) {
		// 	coords.push({x: this.xy.twoTheta[i], y: this.xy.intensity[i]});
		// }

		// Chart of the line spectra
		const lineCoordinates = this.smoothPeaks(this.xy, this.thetaLow, this.thetaHigh, 0.05, this.width);

		// Data and options for the chart
		const chartData: Partial<ChartData> = {

			datasets: [
				// {
				// 	label: "(2θ, Intensity)",
				// 	borderColor: "transparent",
				// 	backgroundColor: "#00ff00",
				// 	data: coords,
				// 	pointRadius: 5,
				// },
				{
					label: "(2θ, Intensity)",
					data: lineCoordinates,
					borderColor: "#00ff00",
					backgroundColor: "#00ff00",
					showLine: true,
					pointRadius: 0,
				}
			]
		};

		const chartOptions: ChartOptions = {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: false
				}
			},
			elements: {line: {borderWidth: 2}},
			scales: {
				x: {
					title: {
						color: "red",
						display: true,
						text: "2θ",
						font: {
							size: 20,
							// weight: "bold"
						},
					},
					grid: {
						color: "#575757"
					}
				},
				y: {
					title: {
						color: "red",
						display: true,
						text: "Intensity",
						font: {
							size: 20,
							// weight: "bold"
						},
					},
					grid: {
						color: "#575757"
					}
				}
			}
		};

		return JSON.stringify({
			data: chartData,
			options: chartOptions,
			type: "scatter"
		});
	}

	/**
	 * Smooth the diffraction peaks using a gaussian
	 *
	 * @param xy - The diffraction pattern computed
	 * @param min - Theta min value
	 * @param max - Theta max value
	 * @param step - Step for the line points
	 * @param width - Width of the gaussian to be used to smooth the peaks
	 * @returns Array of points coordinates to be used in the chart
	 */
	private smoothPeaks(xy: DiffractionPatternResult,
						min: number,
						max: number,
						step: number,
						width: number): ChartCoordinates {

		const out: ChartCoordinates = [];
		for(let x=min; x <= max; x += step) {
			out.push({x, y: 0});
		}
		const nPoints = out.length;

		const len = xy.intensity.length;
		for(let i=0; i < len; ++i) {

			const mean = xy.twoTheta[i];
			const peak = xy.intensity[i];
			// const den = 2*(width/2.35482)**2;
			const den = 2*(width*0.8493218)**2;

			for(let j=0; j < nPoints; ++j) {
				out[j].y += peak*Math.exp(-((out[j].x-mean)**2)/den);
			}
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
			enableComputation: Boolean(this.structure),
			scaled: this.scaled,
			thetaLow: this.thetaLow,
			thetaHigh: this.thetaHigh,
			width: this.width,
			wavelengthCode: this.wavelengthCode,
			wavelengthCodes: JSON.stringify(this.xrd.getWavelengthNames())
		};
	}

	/**
	 * Channel handler to change the chart parameters
	 */
	private channelShow(params: CtrlParams): void {

		if(this.structure && isSecondaryWindowOpen(undefined, "/chart")) {

			this.width = params.width as number ?? 0.5;

			// Compute chart data
			const dataToSend = this.createDataForChart();

			// Update window
			sendToSecondaryWindow(undefined, {routerPath: "/chart", data: dataToSend});
		}
	}

	/**
	 * Channel handler for compute and show diffraction pattern if the window is already open
	 */
	private channelCompute(params: CtrlParams): void {

		if(this.structure && isSecondaryWindowOpen(undefined, "/chart")) {

			this.wavelengthCode = params.wavelengthCode as string ?? "CuKa";
			this.thetaLow = params.thetaLow as number ?? 0;
			this.thetaHigh = params.thetaHigh as number ?? 90;
			this.scaled = params.scaled as boolean ?? true;
			this.width = params.width as number ?? 0.5;

			// Compute spectra
			this.xy = this.xrd.getDiffractionPattern(this.structure, this.wavelengthCode, this.scaled,
													 this.thetaLow, this.thetaHigh);

			// Compute chart data
			const dataToSend = this.createDataForChart();

			// Update window
			sendToSecondaryWindow(undefined, {routerPath: "/chart", data: dataToSend});
		}
	}

	/**
	 * Channel handler for compute and show diffraction pattern when the chart window is requested
	 */
	private channelOpen(params: CtrlParams): void {

		if(this.structure) {

			this.wavelengthCode = params.wavelengthCode as string ?? "CuKa";
			this.thetaLow = params.thetaLow as number ?? 0;
			this.thetaHigh = params.thetaHigh as number ?? 90;
			this.scaled = params.scaled as boolean ?? true;
			this.width = params.width as number ?? 0.5;

			// Compute spectra
			this.xy = this.xrd.getDiffractionPattern(this.structure, this.wavelengthCode, this.scaled,
		 											 this.thetaLow, this.thetaHigh);

			// Compute chart data
			const dataToSend = this.createDataForChart();

			// if already open, update chart, otherwise create the window
			if(isSecondaryWindowOpen(undefined, "/chart")) {

				sendToSecondaryWindow(undefined, {routerPath: "/chart", data: dataToSend});
			}
			else {

				createSecondaryWindow(undefined, {
					routerPath: "/chart",
					width: 1067,
					height: 800,
					title: this.chartTitle,
					data: dataToSend
				});
			}
		}
	}
}
