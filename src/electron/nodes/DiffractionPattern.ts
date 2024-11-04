/**
 * Computes the X-Ray Diffraction pattern of a crystal structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-11-04
 */
import {NodeCore} from "../modules/NodeCore";
import type {Structure, UiInfo, CtrlParams, ChannelDefinition, ChartData, ChartOptions} from "@/types";
import {createSecondaryWindow, isSecondaryWindowOpen, sendToSecondaryWindow} from "../modules/WindowsUtilities";

interface PatternValues {
	twoTheta: number[];
	intensity: number[];
}

// Fake class till the real class is finished and integrated
class XRDCalculator {

	getWavelengthNames(): string[] {

		return [
			"CuKa",
			"CuKa2",
			"CuKa1",
			"CuKb1",
			"MoKa",
		];
	}

	getDiffractionPattern(structure: Structure,
						  wavelengthCode="CuKa",
						  scaled=true,
						  thetaLow=0,
						  thetaHight=90): PatternValues {
		void structure;
		void wavelengthCode;
		void scaled;
		void thetaLow;
		void thetaHight;

		return {
			twoTheta:  [28.46772426, 47.34657519, 56.17571327, 69.19895076, 76.45494946, 88.1268895],
			intensity: [100.0000000, 66.64746966, 39.58448396, 10.71251618, 16.34081066, 23.50766372]
		};
	}
}

export class DiffractionPattern extends NodeCore {

	private structure: Structure | undefined;
	private scaled = true;
	private thetaLow = 0;
	private thetaHigh = 90;
	private wavelengthCode = "CuKa";
	private openChart = false;
	private readonly xrd = new XRDCalculator();

	private readonly channels: ChannelDefinition[] = [
		{name: "init",      type: "invoke", callback: this.channelInit.bind(this)},
		{name: "show",      type: "invoke", callback: this.channelShow.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	override fromPreviousNode(data: Structure): void {

		this.structure = data;

		if(this.openChart && data) {

			const xy = this.xrd.getDiffractionPattern(data, this.wavelengthCode, this.scaled,
													  this.thetaLow, this.thetaHigh);
			this.makeChart(xy);
			this.openChart = false;
		}
	}

	saveStatus(): string {
        const statusToSave = {
			scaled: this.scaled,
			thetaLow: this.thetaLow,
			thetaHigh: this.thetaHigh,
			wavelengthCode: this.wavelengthCode
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		this.scaled = params.scaled as boolean ?? true;
		this.thetaLow = params.thetaLow as number ?? 0;
		this.thetaHigh = params.thetaHigh as number ?? 90;
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

	private makeChart(xy: PatternValues): void {

		const chartTitle = "X-Ray diffraction pattern";

		const coords: {x: number; y: number}[] = [];
		const len = xy.intensity.length;
		for(let i=0; i < len; ++i) {
			coords.push({x: xy.twoTheta[i], y: xy.intensity[i]});
		}
		const chartData: ChartData = {
			datasets: [
				{
					label: "Scatter Dataset 1",
					fill: false,
					borderColor: "#f87979",
					backgroundColor: "#f87979",
					data: coords
				}
			]
		};

		const chartOptions: ChartOptions = {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				title: {
					text: chartTitle,
					display: true,
					font: {
						size: 30
					}
				}
			},
			scales: {
				x: {
					title: {
						color: "red",
						display: true,
						text: "Two theta"
					},
					grid: {
						color: "aqua"
					}
				},
				y: {
					title: {
						color: "green",
						display: true,
						text: "Intensity"
					},
					grid: {
						color: "aqua"
					}
				}
			}
		};

		const dataToSend = JSON.stringify({
			data: chartData,
			options: chartOptions,
			type: "scatter"
		});

		// if already open, update chart
		if(isSecondaryWindowOpen(undefined, "/chart")) {

			sendToSecondaryWindow(undefined, {routerPath: "/chart", data: dataToSend});
		}
		else {

			createSecondaryWindow(undefined, {
				routerPath: "/chart",
				width: 800,
				height: 600,
				title: chartTitle,
				data: dataToSend
			});
		}
		void xy;
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			scaled: this.scaled,
			thetaLow: this.thetaLow,
			thetaHigh: this.thetaHigh,
			wavelengthCode: this.wavelengthCode,
			wavelengthCodes: JSON.stringify(this.xrd.getWavelengthNames())
		};
	}

	/**
	 * Channel handler for compute and show diffraction pattern
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelShow(params: CtrlParams): CtrlParams {

        this.wavelengthCode = params.wavelengthCode as string ?? "CuKa";
        this.thetaLow = params.theta as number ?? 0;
        this.thetaHigh = params.theta as number ?? 90;
        this.scaled = params.scaled as boolean ?? true;
        this.openChart = params.openChart as boolean ?? false;

		// Compute and show chart
		if(this.openChart && this.structure) {

			const xy = this.xrd.getDiffractionPattern(this.structure, this.wavelengthCode, this.scaled,
													  this.thetaLow, this.thetaHigh);
			this.makeChart(xy);
			this.openChart = false;
		}

		return {
			openChart: this.openChart
		};
	}
}
