/**
 * Create a chart in a secondary window.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import {NodeCore} from "../modules/NodeCore";
import {createSecondaryWindow, sendToSecondaryWindow} from "../modules/WindowsUtilities";
import type {UiInfo, CtrlParams, ChannelDefinition,
			 ChartData, ChartOptions} from "@/types";

export class ChartViewer extends NodeCore {

	private chartType = "line";
	private previousChartType = "line";
	private openChart = false;

	// TEST Hardcoded chart data
	private readonly chartTitle = "New test chart";

	private readonly chartData: ChartData = {
		labels: [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December"
		],
		datasets: [
			{
				label: "Data One",
				backgroundColor: "#f87979",
				fill: false,
				data: [40, 20, 12, 39, 10, 40, 39, 80, 40, 20, 12, 11],
				borderColor: "#f87979",
			},
			{
				label: "Data Two",
				backgroundColor: "#00ff00",
				fill: false,
				data: [4, 2, 2, 4, 1, 4, 5, 9, 6, 19, 3, 8],
				borderColor: "#00ff00",
			}
		]
	};

	private readonly chartOptions: ChartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			title: {
				text: this.chartTitle,
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
				text: "Month"
				},
				grid: {
				color: "aqua"
				}
			},
			y: {
				title: {
				color: "green",
				display: true,
				text: "Sales"
				},
				grid: {
				color: "aqua"
				}
			}
		}
	};

	private readonly channels: ChannelDefinition[] = [
		{name: "init",      type: "invoke", callback: this.channelInit.bind(this)},
		{name: "show",      type: "invoke", callback: this.channelShow.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	saveStatus(): string {
        const statusToSave = {
			chartType: this.chartType,
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

		this.chartType = params.chartType as string ?? "line";
	}

	getUiInfo(): UiInfo {
		return {
			id: this.id,
			ui: "ChartViewerCtrl",
			graphic: "none",
			channels: this.channels.map((channel) => channel.name)
		};
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			chartType: this.chartType,
		};
	}

	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelShow(params: CtrlParams): CtrlParams {

		this.chartType = params.chartType as string ?? "line";
		this.openChart = params.openChart as boolean ?? false;

		if(this.openChart) {
			this.computeChart();
			return {openChart: false};
		}
		else if(this.chartType !== this.previousChartType) {
			this.updateChart();
			this.previousChartType = this.chartType;
		}
		return {chartType: this.chartType};
	}

	/**
	 * Compute the chart data and open the chart window
	 */
	private computeChart(): void {

		const dataToSend = JSON.stringify({
			data: this.chartData,
			options: this.chartOptions,
			type: this.chartType
		});

		createSecondaryWindow(undefined, {
			routerPath: "/chart",
			width: 800,
			height: 600,
			title: this.chartTitle,
			data: dataToSend
		});
	}

	/**
	 * Update chart if data changed
	 */
	private updateChart(): void {

		const dataToSend = JSON.stringify({
			data: this.chartData,
			options: this.chartOptions,
			type: this.chartType
		});
		sendToSecondaryWindow(undefined, {routerPath: "/chart", data: dataToSend});
	}
}
