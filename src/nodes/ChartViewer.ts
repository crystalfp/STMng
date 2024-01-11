import {sb, type UiParams} from "@/services/Switchboard";

export class ChartViewer {

	private chartType = "line";

	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {
    		this.chartType = params.chartType as string ?? "line";
		});
	}

	saveStatus(): string {

		const statusToSave = {

			chartType: this.chartType,
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
