/**
 * Create a chart in a secondary window.
 *
 * @packageDocumentation
 */
import {sb, type UiParams} from "@/services/Switchboard";
import {createWindow, sendToWindow} from "@/services/RoutesClient";

export class ChartViewer {

	private chartType = "line";
	private previousChartType = "line";

	// TEST Hardcoded chart data
	private readonly chartTitle = "New test chart";

	private readonly chartData = {
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
					data: [40, 20, 12, 39, 10, 40, 39, 80, 40, 20, 12, 11],
					borderColor: "#f87979",
				},
				{
					label: "Data Two",
					backgroundColor: "#00ff00",
					data: [4, 2, 2, 4, 1, 4, 5, 9, 6, 19, 3, 8],
					borderColor: "#00ff00",
				}
			]
		};

	private readonly chartOptions = {
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

	/**
	 * Create the node
	 *
	 * @param id - ID of the Chart viewer node
	 */
	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {
    		this.chartType = params.chartType as string ?? "line";
			const openChart = params.openChart as boolean ?? false;
			if(openChart) {
				sb.setUiParams(this.id, {openChart: false});
				this.computeChart();
			}
			else if(this.chartType !== this.previousChartType) {
				this.updateChart();
				this.previousChartType = this.chartType;
			}
		});
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

		createWindow({
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
		sendToWindow("/chart", dataToSend);
	}

	/**
	 * Save the node status
	 *
	 * @returns Node status as JSON formatted string
	 */
	saveStatus(): string {

		const statusToSave = {

			chartType: this.chartType,
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
