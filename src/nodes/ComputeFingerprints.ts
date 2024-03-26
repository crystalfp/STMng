/**
 * Write structures to file.
 *
 * @packageDocumentation
 */
import {sb, type UiParams} from "@/services/Switchboard";
import type {Structure} from "@/types";
import {loadEnergyFile} from "@/services/RoutesClient";
import {showErrorNotification, resetErrorNotification} from "@/services/ErrorNotification";
import {useConfigStore} from "@/stores/configStore";

export class ComputeFingerprints {

	private accumulate = false;
	private countAccumulated = 0;
	private readonly encodedStructures: string[] = [];
    private enableEnergyThreshold = false;
    private energyThreshold = 0;
    private energyThresholdEffective = 0;
    private countSelected = 0;
	// private energyFileLoading = false;
	private energyFilePrevious = "";

	/**
	 * Create the node
	 *
	 * @param id - ID of the Compute Fingerprints node
	 */
	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {

			if(params.reset) {
				this.encodedStructures.length = 0;
				configStore.control.fingerprintsAccumulate = false;
				sb.setUiParams(this.id, {
					accumulate: false,
					reset: false,
					countAccumulated: 0,
					countSelected: 0,
				});
				return;
			}

    		this.accumulate = params.accumulate as boolean ?? false;
			this.loadEnergyFile(params.energyFilePath as string | undefined);
    		this.enableEnergyThreshold = params.enableEnergyThreshold as boolean ?? false;
    		this.energyThreshold = params.energyThreshold as number ?? 0;
    		this.energyThresholdEffective = params.energyThresholdEffective as number ?? 0;
    		this.countSelected = params.countSelected as number ?? 0;
		});

		sb.getData(this.id, (data: unknown) => {

			const structure = data as Structure;
			if(!structure) return;

			// If in accumulate mode save the structure encoded
			if(configStore.control.fingerprintsAccumulate) {
			// if(this.accumulate) {
				this.encodedStructures.push(JSON.stringify(structure));
				++this.countAccumulated;
				sb.setUiParams(this.id, {
					countAccumulated: this.countAccumulated
				});
			}
		});

		const configStore = useConfigStore();
        configStore.control.hasFingerprints = true;
	}

	loadEnergyFile(energyFilePath: string | undefined): void {

		resetErrorNotification("fingerprints");
		// if(this.energyFileLoading) return;
		if(!energyFilePath) return;
		if(energyFilePath === this.energyFilePrevious) return;
		this.energyFilePrevious = energyFilePath;

		sb.setUiParams(this.id, {energyFileLoading: true});
		// this.energyFileLoading = true;

		loadEnergyFile(energyFilePath)
			.then((status) => {
				if(status.error) throw Error(status.error);

				sb.setUiParams(this.id, {energyFileLoading: false});
				// this.energyFileLoading = false;
			})
			.catch((error: Error) => {
				showErrorNotification(`Error reading energy file: ${error.message}`, "fingerprints");
				sb.setUiParams(this.id, {energyFileLoading: false});
				// this.energyFileLoading = false;
			});
	}

	filterStructures(): void {

		if(this.encodedStructures.length === 0) return;


	}

	/**
	 * Save the node status
	 *
	 * @returns The JSON formatted status to be saved
	 */
	saveStatus(): string {

		const statusToSave = {
			accumulate: this.accumulate,
			enableEnergyThreshold: this.enableEnergyThreshold,
			energyThreshold: this.energyThreshold,
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
