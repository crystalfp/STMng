/**
 * Computes and display the X-Ray Diffraction pattern of a crystal structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-11-04
 */
import {ipcMain, dialog} from "electron";
import {closeSync, openSync, writeSync} from "node:fs";
import {NodeCore} from "../modules/NodeCore";
import {XRDCalculator, type DiffractionPatternResult} from "../modules/XRDCalculator";
import {createOrUpdateSecondaryWindow, isSecondaryWindowOpen,
		sendToSecondaryWindow} from "../modules/WindowsUtilities";
import {sendAlertToClient, sendToClient} from "../modules/ToClient";
import {hasUnitCell} from "../modules/Helpers";
import type {Structure, CtrlParams, ChannelDefinition,
			 ChartData, ChartOptions, ChartCoordinate} from "@/types";


export class DiffractionPattern extends NodeCore {

	private structure: Structure | undefined;
	private scaled = true;
	private thetaLow = 0;
	private thetaHigh = 90;
	private width = 0.25;
	private showHKL = false;
	private wavelengthCode = "CuKa";
	private wavelengthNumeric = 1.5;
	private readonly xrd = new XRDCalculator();
	private xy: DiffractionPatternResult = {twoTheta: [], intensity: [], label: []};
	private readonly chartTitle = "X-Ray diffraction pattern";
	private channelSavePointsOpened = false;
	private lineCoordinates: ChartCoordinate[] = [];


	private readonly channels: ChannelDefinition[] = [
		{name: "init",    type: "invoke", callback: this.channelInit.bind(this)},
		{name: "show",    type: "send",   callback: this.channelShow.bind(this)},
		{name: "open",    type: "send",   callback: this.channelOpen.bind(this)},
		{name: "compute", type: "send",   callback: this.channelCompute.bind(this)},
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
		const hasData = Boolean(data) && hasUnitCell(data.crystal.basis);

		// There is the structure so the XRD could be computed
		sendToClient(this.id, "enable", {enableComputation: hasData});

		if(hasData && isSecondaryWindowOpen("/chart")) {

			// Compute spectra
			try {
				this.xy = this.xrd.getDiffractionPattern(this.structure,
														 this.wavelengthCode,
														 this.scaled,
														 this.thetaLow,
														 this.thetaHigh);
			}
			catch(error: unknown) {
				sendAlertToClient(`Error in getDiffractionPattern: ${(error as Error).message}`);
				return;
			}

			// Compute chart data
			const dataToSend = this.createDataForChart();

			// Update window
			sendToSecondaryWindow("/chart", dataToSend);
		}
	}

	// > Load/save status
	saveStatus(): string {
        const statusToSave = {
			scaled: this.scaled,
			thetaLow: this.thetaLow,
			thetaHigh: this.thetaHigh,
			width: this.width,
			wavelengthCode: this.wavelengthCode,
			wavelengthNumeric: this.wavelengthNumeric,
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
		this.wavelengthNumeric = params.wavelengthNumeric as number ?? 1.5;
		this.showHKL = params.showHKL as boolean ?? false;
	}

	/**
	 * Create and pack the data for the chart viewer
	 *
	 * @returns JSON encoded chart data to be sent to the chart viewer
	 */
	private createDataForChart(): string {

		// Normalize the peaks
		const len = this.xy.intensity.length;
		const y = [...this.xy.intensity];
		if(this.width > 0) {
			const mult = 0.9394372786996513/this.width;
			for(let i=0; i < len; ++i) {
				y[i] *= mult;
			}
		}

		// And scale them to 100
		if(this.scaled) {
			let maxValue = -1;
			for(let i=0; i < len; ++i) {
				if(y[i] > maxValue) maxValue = y[i];
			}
			const scale = 100/maxValue;
			for(let i=0; i < len; ++i) y[i] *= scale;
		}

		// Chart of the peaks
		const coords = Array<ChartCoordinate>(len);
		const labels = Array<string>(len);
		for(let i=0; i < len; ++i) {
			coords[i] = {x: this.xy.twoTheta[i], y: y[i]};
			labels[i] = this.xy.label[i];
		}

		// Chart of the line spectra
		this.lineCoordinates = this.width > 0 ?
									this.smoothPeaks(this.xy.twoTheta, y,
													 this.thetaLow, this.thetaHigh, this.width) :
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
					data: this.lineCoordinates,
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
	 * @param x - Peak intensities
	 * @param y - Peak position
	 * @param min - Theta min value
	 * @param max - Theta max value
	 * @param width - Width of the gaussian to be used to smooth the peaks (FWHM)
	 * @returns Array of points coordinates to be used in the chart
	 */
	private smoothPeaks(x: number[],
						y: number[],
						min: number,
						max: number,
						width: number): ChartCoordinate[] {

		const step = (max-min)/2_000;
		const out: ChartCoordinate[] = [];
		for(let xx=min; xx <= max; xx += step) {
			out.push({x: xx, y: 0});
		}
		const nPoints = out.length;

		const len = x.length;
		for(let i=0; i < len; ++i) {

			const mean = x[i];
			const peak = y[i];
			const den = width**2/2.772588722239781;

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
					  max: number): ChartCoordinate[] {

		const len = xy.intensity.length;
		let scale = 1;
		if(this.scaled) {

			let maxIntensity = 0;
			for(let j=0; j < len; ++j) {
				if(xy.intensity[j] > maxIntensity) maxIntensity = xy.intensity[j];
			}
			scale = maxIntensity > 0 ? 100/maxIntensity : 1;
		}

		const out: ChartCoordinate[] = [{x: min, y: 0}];
		for(let i=0; i < len; ++i) {
			const mean = xy.twoTheta[i];
			const peak = xy.intensity[i]*scale;
			out.push({x: mean, y: 0}, {x: mean, y: peak}, {x: mean, y: 0});
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
			wavelengthCodes: this.xrd.getWavelengthNames(),
			wavelengthNumeric: this.wavelengthNumeric
		};
	}

	/**
	 * Channel handler to change the chart parameters
	 */
	private channelShow(params: CtrlParams): void {

		if(this.structure && isSecondaryWindowOpen("/chart")) {

			this.width = params.width as number ?? 0.25;
			this.showHKL = params.showHKL as boolean ?? false;

			// Compute chart data
			const dataToSend = this.createDataForChart();

			// Update window
			sendToSecondaryWindow("/chart", dataToSend);
		}
	}

	/**
	 * Channel handler for compute and show diffraction pattern if the window is already open
	 */
	private channelCompute(params: CtrlParams): void {

		if(this.structure && isSecondaryWindowOpen("/chart")) {

			this.wavelengthCode = params.wavelengthCode as string ?? "CuKa";
			this.wavelengthNumeric = params.wavelengthNumeric as number ?? 1.5;
			this.thetaLow = params.thetaLow as number ?? 0;
			this.thetaHigh = params.thetaHigh as number ?? 90;
			this.scaled = params.scaled as boolean ?? true;
			this.width = params.width as number ?? 0.25;
			this.showHKL = params.showHKL as boolean ?? false;

			// Compute spectra
			try {
				this.xy = this.xrd.getDiffractionPattern(this.structure, this.wavelengthCode, this.scaled,
														this.thetaLow, this.thetaHigh, this.wavelengthNumeric);
			}
			catch(error: unknown) {
				sendAlertToClient(`Error in getDiffractionPattern: ${(error as Error).message}`);
				return;
			}

			// Compute chart data
			const dataToSend = this.createDataForChart();

			// Update window
			sendToSecondaryWindow("/chart", dataToSend);
		}
	}

	/**
	 * Channel handler for compute and show diffraction pattern when the chart window is requested
	 */
	private channelOpen(params: CtrlParams): void {

		if(this.structure) {

			this.wavelengthCode = params.wavelengthCode as string ?? "CuKa";
			this.wavelengthNumeric = params.wavelengthNumeric as number ?? 1.5;
			this.thetaLow = params.thetaLow as number ?? 0;
			this.thetaHigh = params.thetaHigh as number ?? 90;
			this.scaled = params.scaled as boolean ?? true;
			this.width = params.width as number ?? 0.25;
			this.showHKL = params.showHKL as boolean ?? false;

			// Compute spectra
			try {
				this.xy = this.xrd.getDiffractionPattern(this.structure, this.wavelengthCode, this.scaled,
														this.thetaLow, this.thetaHigh, this.wavelengthNumeric);
			}
			catch(error: unknown) {
				sendAlertToClient(`Error in getDiffractionPattern: ${(error as Error).message}`);
				return;
			}

			// Compute chart data
			const dataToSend = this.createDataForChart();

			// if already open, update chart, otherwise create the window
			createOrUpdateSecondaryWindow({
				routerPath: "/chart",
				width: 1067,
				height: 800,
				title: this.chartTitle,
				data: dataToSend,
				alwaysOnTop: true
			});

			if(!this.channelSavePointsOpened) {
				this.channelSavePointsOpened = true;

				ipcMain.on("SYSTEM:save-xrd", () => {

					const file = dialog.showSaveDialogSync({
						title: "Save X-Ray diffraction points",
						filters: [
							{name: "Point data", extensions: ["dat"]},
						]
					});
					if(file) {
						try {
							let out = "";
							for(const point of this.lineCoordinates) {
								out += `${point.x.toFixed(4)} ${point.y.toExponential(8)}\n`;
							}
							const fd = openSync(file, "w");
							writeSync(fd, out);
							closeSync(fd);
						}
						catch(error: unknown) {
							sendAlertToClient(`Error in save-xrd: ${(error as Error).message}`);
						}
					}
				});
			}
		}
	}
}
