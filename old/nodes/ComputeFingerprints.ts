/**
 * Compute fingerprints for an accumulated set of structures.
 *
 * @packageDocumentation
 */
import {watch} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {loadEnergyFile, setEnergyFilterParameters,
		accumulateStructure, computeFingerprints} from "@/services/RoutesClient";
import {showErrorNotification, resetErrorNotification} from "@/services/ErrorNotification";
import {useControlStore} from "@/stores/controlStore";
import type {Structure} from "@/types";

export class ComputeFingerprints {

    private enableEnergyThreshold = false;
	private thresholdFromMinimum = false;
    private energyThreshold = "0";
	private energyFilePrevious = "";
	private structure: Structure | undefined;
	private accumulatePrevious = false;
	private forceCutoff = false;
	private manualCutoffDistance = 10;
	private selectedMethod = 0;
	private binSize = 0.05;
	private peakWidth = 0.05;
	private selectDistanceMethod = 0;
	private fixTriangleInequality = false;

	/**
	 * Create the node
	 *
	 * @param id - ID of the Compute Fingerprints node
	 */
	constructor(private readonly id: string) {

		const controlStore = useControlStore();

		// Start with a clean accumulator
		void accumulateStructure();

		sb.getUiParams(this.id, (params: UiParams) => {

			if(params.reset) {

				controlStore.fingerprintsAccumulate = false;
				sb.setUiParams(this.id, {
					reset: false,
					countAccumulated: 0,
					countSelected: 0,
				});
				void accumulateStructure();
				return;
			}

			this.forceCutoff = params.forceCutoff as boolean ?? false;
			this.manualCutoffDistance = params.manualCutoffDistance as number ?? 10;
			this.selectedMethod = params.selectedMethod as number ?? 0;
			this.binSize = params.binSize as number ?? 0.05;
			this.peakWidth = params.peakWidth as number ?? 0.05;
			if(params.computeFingerprints) {

				sb.setUiParams(this.id, {
					computeFingerprints: false,
					resultDimensionality: 0
				});
				computeFingerprints(this.forceCutoff, this.manualCutoffDistance,
									this.selectedMethod, this.binSize, this.peakWidth)
					.then((status) => {
						if(status.error) throw Error(status.error);
						const dim = JSON.parse(status.payload) as number;
						sb.setUiParams(this.id, {
							resultDimensionality: dim
						});
					})
					.catch((error: Error) => {
						showErrorNotification(`Error computing fingerprints: ${error.message}`,
											  "fingerprints");
					});
				return;
			}

			this.selectDistanceMethod = params.selectDistanceMethod as number ?? 0;
			this.fixTriangleInequality = params.fixTriangleInequality as boolean ?? false;
			if(params.computeDistances) {
				sb.setUiParams(this.id, {computeDistances: false});
				console.log("DIST", this.selectDistanceMethod, this.fixTriangleInequality); // TBD
				return;
			}

			this.loadEnergyFile(params.energyFilePath as string | undefined);
    		this.enableEnergyThreshold = params.enableEnergyThreshold as boolean ?? false;
    		this.thresholdFromMinimum = params.thresholdFromMinimum as boolean ?? false;
    		this.energyThreshold = params.energyThreshold as string ?? "0";
			this.setFilterParams();
		});

		watch(controlStore, () => {
			if(controlStore.fingerprintsAccumulate) {
				if(!this.accumulatePrevious && this.structure) {

					accumulateStructure(this.structure)
						.then((status) => {

							if(status.error) throw Error(status.error);
							const {total, filtered} = JSON.parse(status.payload) as {total: number; filtered: number};
							sb.setUiParams(this.id, {
								countAccumulated: total,
								countSelected: filtered
							});
							this.accumulatePrevious = true;
						})
						.catch((error: Error) => {
							showErrorNotification(`Error accumulating structures: ${error.message}`,
												  "fingerprints");
						});
				}
			}
			else {
				this.accumulatePrevious = false;
			}
		});

		sb.getData(this.id, (data: unknown) => {

			this.structure = data as Structure;
			if(!this.structure) return;

			// If in accumulate mode, save the structure encoded
			if(controlStore.fingerprintsAccumulate) {
				accumulateStructure(this.structure)
					.then((status) => {

						if(status.error) throw Error(status.error);
						const {total, filtered} = JSON.parse(status.payload) as {total: number; filtered: number};
						sb.setUiParams(this.id, {
							countAccumulated: total,
							countSelected: filtered
						});
					})
					.catch((error: Error) => {
						showErrorNotification(`Error accumulating structures: ${error.message}`,
												"fingerprints");
					});
			}
		});

        controlStore.hasFingerprints = true;
	}

	/**
	 * Read the energy file.
	 *
	 * @remarks The file should have one floating point value per line.
	 * @param energyFilePath - File path
	 */
	private loadEnergyFile(energyFilePath: string | undefined): void {

		resetErrorNotification("fingerprints");

		if(!energyFilePath || energyFilePath === this.energyFilePrevious) return;
		this.energyFilePrevious = energyFilePath;

		sb.setUiParams(this.id, {energyFileLoading: true});

		loadEnergyFile(energyFilePath)
			.then((status) => {
				if(status.error) throw Error(status.error);

				sb.setUiParams(this.id, {energyFileLoading: false});
			})
			.catch((error: Error) => {
				showErrorNotification(`Error reading energy file: ${error.message}`, "fingerprints");
				sb.setUiParams(this.id, {energyFileLoading: false});
			});
	}

	/**
	 * Pass the filtering parameters to the main process.
	 */
	private setFilterParams(): void {

		if(this.energyThreshold.trim() === "") return;

		const threshold = Number.parseFloat(this.energyThreshold);
		if(Number.isNaN(threshold)) return;

		setEnergyFilterParameters(this.enableEnergyThreshold,
								  threshold, this.thresholdFromMinimum)
			.then((status) => {
				if(status.error) throw Error(status.error);
				const {effectiveEnergy, selected} = JSON.parse(status.payload) as {effectiveEnergy: number; selected: number};

				sb.setUiParams(this.id, {
					countSelected: selected,
					energyThresholdEffective: effectiveEnergy
				});
			})
			.catch((error: Error) => {
				showErrorNotification(`Error setting filter parameters: ${error.message}`, "fingerprints");
			});
	}

	/**
	 * Save the node status
	 *
	 * @returns The JSON formatted status to be saved
	 */
	saveStatus(): string {

		const statusToSave = {
			enableEnergyThreshold: this.enableEnergyThreshold,
			energyThreshold: this.energyThreshold,
			thresholdFromMinimum: this.thresholdFromMinimum,
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
