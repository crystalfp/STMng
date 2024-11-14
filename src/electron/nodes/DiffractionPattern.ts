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
	private width = 0.25;
	private showHKL = false;
	private wavelengthCode = "CuKa";
	private readonly xrd = new XRDCalculator();
	private xy: DiffractionPatternResult = {twoTheta: [], intensity: [], label: []};
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
			wavelengthCode: this.wavelengthCode,
			showHKL: this.showHKL
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		this.scaled = params.scaled as boolean ?? true;
		this.thetaLow = params.thetaLow as number ?? 0;
		this.thetaHigh = params.thetaHigh as number ?? 90;
		this.width = params.width as number ?? 0.25;
		this.wavelengthCode = params.wavelengthCode as string ?? "CuKa";
		this.showHKL = params.showHKL as boolean ?? false;
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
		const coords: ChartCoordinates = [];
		const labels: string[] = [];
		const len = this.xy.intensity.length;
		for(let i=0; i < len; ++i) {
			coords.push({x: this.xy.twoTheta[i], y: this.xy.intensity[i]});
			labels.push(this.xy.label[i]);
		}

		// Chart of the line spectra
		const lineCoordinates = this.width > 0 ?
									this.smoothPeaks(this.xy, this.thetaLow, this.thetaHigh, this.width) :
									this.hardPeaks(this.xy, this.thetaLow, this.thetaHigh);

		// Data and options for the chart
		const chartData: ChartData = {
			datasets: [
				{
					label: "(2θ, Intensity)",
					borderColor: "transparent",
					backgroundColor: "#00ff00",
					data: coords,
					pointRadius: 0,
					datalabels: {
    					color: "#36A2EB",
						align: "right",
						anchor: "center"
					}
				},
				{
					label: "(2θ, Intensity)",
					data: lineCoordinates,
					borderColor: "#00ff00",
					backgroundColor: "#00ff00",
					showLine: true,
					pointRadius: 0,
					datalabels: {
    					display: false
					}
				}
			]
		};

		if(this.showHKL) {
			chartData.labels = labels;
			chartData.datasets[0].datalabels!.display = true;
		}
		else {
			chartData.datasets[0].datalabels!.display = false;
		}

		const chartOptions: ChartOptions = {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: false
				},
			},
			elements: {line: {borderWidth: 2}},
			layout: {padding: 20},
			scales: {
				x: {
					title: {
						color: "red",
						display: true,
						text: "2θ",
						font: {
							size: 20,
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
	 * @param xy - The computed diffraction pattern
	 * @param min - Theta min value
	 * @param max - Theta max value
	 * @param width - Width of the gaussian to be used to smooth the peaks (FWHM)
	 * @returns Array of points coordinates to be used in the chart
	 */
	private smoothPeaks(xy: DiffractionPatternResult,
						min: number,
						max: number,
						width: number): ChartCoordinates {

		const step = (max-min)/2_000;
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
			const den = 2*(width*0.424661)**2;

			for(let j=0; j < nPoints; ++j) {
				out[j].y += peak*Math.exp(-((out[j].x-mean)**2)/den);
			}
		}
		if(this.scaled) {

			let maxIntensity = 0;
			for(let j=0; j < nPoints; ++j) {
				if(out[j].y > maxIntensity) maxIntensity = out[j].y;
			}
			const scale = 100/maxIntensity;
			for(let j=0; j < nPoints; ++j) {
				out[j].y *= scale;
			}
		}
		return out;
	}

	/**
	 * The computed diffraction peaks without smoothing
	 *
	 * @param xy - The computed diffraction pattern
	 * @param min - Theta min value
	 * @param max - Theta max value
	 * @returns Array of points coordinates to be used in the chart
	 */
	private hardPeaks(xy: DiffractionPatternResult,
					  min: number,
					  max: number): ChartCoordinates {

		const len = xy.intensity.length;
		let scale = 1;
		if(this.scaled) {

			let maxIntensity = 0;
			for(let j=0; j < len; ++j) {
				if(xy.intensity[j] > maxIntensity) maxIntensity = xy.intensity[j];
			}
			scale = maxIntensity > 0 ? 100/maxIntensity : 1;
		}

		const out: ChartCoordinates = [];
		out.push({x: min, y: 0});
		for(let i=0; i < len; ++i) {
			const mean = xy.twoTheta[i];
			const peak = xy.intensity[i]*scale;
			out.push({x: mean, y: 0});
			out.push({x: mean, y: peak});
			out.push({x: mean, y: 0});
		}
		out.push({x: max, y: 0});
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

			this.width = params.width as number ?? 0.25;
			this.showHKL = params.showHKL as boolean ?? false;

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
			this.width = params.width as number ?? 0.25;
			this.showHKL = params.showHKL as boolean ?? false;

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
			this.width = params.width as number ?? 0.25;
			this.showHKL = params.showHKL as boolean ?? false;

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

				// Workaround for chart not appearing due to timing
				setTimeout(() => sendToSecondaryWindow(undefined, {routerPath: "/chart", data: dataToSend}), 600);
			}
		}
	}
}
