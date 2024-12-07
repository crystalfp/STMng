/**
 * Compute fingerprints for an accumulated set of structures.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import fs from "node:fs";
import {NodeCore} from "../modules/NodeCore";
import {sendAlertMessage, sendToClient} from "../modules/WindowsUtilities";
import type {Structure, CtrlParams, ChannelDefinition} from "@/types";
import {FingerprintsAccumulator} from "../modules/FingerprintsAccumulator";

export class ComputeFingerprints extends NodeCore {

	private structure: Structure | undefined;
	private readonly accumulator = new FingerprintsAccumulator();

    private enableEnergyFiltering = false;
	private thresholdFromMinimum = false;
    private energyThreshold = 0;
	private fingerprintsAccumulate = false;

	// private forceCutoff = false;
	// private manualCutoffDistance = 10;
	// private selectedMethod = 0;
	// private binSize = 0.05;
	// private peakWidth = 0.05;
	// private selectDistanceMethod = 0;
	// private fixTriangleInequality = false;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",      type: "invoke", callback: this.channelInit.bind(this)},
		{name: "capture",   type: "invoke", callback: this.channelCapture.bind(this)},
		{name: "reset",     type: "send",   callback: this.channelReset.bind(this)},
		{name: "energy",    type: "invoke", callback: this.channelEnergy.bind(this)},

		{name: "fp",		type: "invoke", callback: this.channelFP.bind(this)},
		{name: "change",    type: "send",   callback: this.channelChange.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	override fromPreviousNode(data: Structure): void {

		this.structure = data;
		if(!this.structure) return;

		// If in accumulate mode, save the structure encoded
		if(this.fingerprintsAccumulate) {

			this.accumulator.add(this.structure);
			this.doFiltering();
		}
		else {
			sendToClient(this.id, "load", {
				countSelected: this.accumulator.size(),
				countAccumulated: this.accumulator.size(),
				energyThresholdEffective: this.energyThreshold
			});
		}
	}

	private doFiltering(): void {

		const status = this.accumulator.filterOnEnergy(this.enableEnergyFiltering,
													   this.energyThreshold,
													   this.thresholdFromMinimum);
		if(status.error) {
			sendAlertMessage(status.error, "fingerprints");
			sendToClient(this.id, "load", {
				countSelected: 0,
				countAccumulated: this.accumulator.size(),
				energyThresholdEffective: status.threshold
			});
		}
		else {
			sendToClient(this.id, "load", {
				countSelected: status.countSelected,
				countAccumulated: this.accumulator.size(),
				energyThresholdEffective: status.threshold
			});
		}
	}

	saveStatus(): string {
        const statusToSave = {
			enableEnergyFiltering: this.enableEnergyFiltering,
			energyThreshold: this.energyThreshold,
			thresholdFromMinimum: this.thresholdFromMinimum,
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		this.enableEnergyFiltering = params.enableEnergyFiltering as boolean ?? false;
		this.thresholdFromMinimum = params.thresholdFromMinimum as boolean ?? false;
		this.energyThreshold = params.energyThreshold as number ?? 0;
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {

			enableEnergyFiltering: this.enableEnergyFiltering,
			thresholdFromMinimum: this.thresholdFromMinimum,
			energyThreshold: this.energyThreshold,
			energyThresholdEffective: this.accumulator.filtered().threshold,

			// forceCutoff.value = params.forceCutoff as boolean ?? false;
			// cutoffDistance.value = params.cutoffDistance as number ?? 12;
			// manualCutoffDistance.value = params.manualCutoffDistance as number ?? 10;
			// selectedMethod.value = params.selectedMethod as number ?? 0;
			// binSize.value = params.binSize as number ?? 0.05;
			// peakWidth.value = params.peakWidth as number ?? 0.05;
			// resultDimensionality.value = params.resultDimensionality as number ?? 0;

			// selectedDistanceMethod.value = params.selectedDistanceMethod as number ?? 0;
			// fixTriangleInequality.value = params.fixTriangleInequality as boolean ?? false;
		};
	}

	/**
	 * Channel handler for fingerprint accumulate change
	 *
	 * @param params - Fingerprint accumulate status
	 * @returns Filtering results
	 */
	private channelCapture(params: CtrlParams): CtrlParams {

		this.fingerprintsAccumulate = params.fingerprintsAccumulate as boolean ?? false;

		if(this.fingerprintsAccumulate && this.structure) {

			this.accumulator.add(this.structure);
			const status = this.accumulator.filterOnEnergy(this.enableEnergyFiltering,
														   this.energyThreshold,
														   this.thresholdFromMinimum);
			if(status.error) {
				sendAlertMessage(status.error, "fingerprints");
				return {
					countSelected: 0,
					countAccumulated: this.accumulator.size(),
					energyThresholdEffective: status.threshold
				};
			}
			return {
				countSelected: status.countSelected,
				countAccumulated: this.accumulator.size(),
				energyThresholdEffective: status.threshold,
			};
		}

		return {
		    countSelected: this.accumulator.filtered().countSelected,
        	countAccumulated: this.accumulator.size(),
			energyThresholdEffective: this.energyThreshold,
		};
	}

	/**
	 * Channel handler for symmetry parameters change
	 *
	 * @returns Computed symmetry
	 */
	private channelChange(params: CtrlParams): void {

		void params; // TBD
	}

	/**
	 * Channel handler for cleaning the accumulator
	 */
	private channelReset(): void {

		this.accumulator.clear();
	}

	/**
	 * Channel handler for energy filtering parameter changes
	 *
	 * @param params - Energy filtering parameters
	 * @returns Results from the filtering
	 */
	private channelEnergy(params: CtrlParams): CtrlParams {

		const filename = params.filename as string;
		if(filename) {
			try {
				const energiesRaw = fs.readFileSync(filename, "utf8") + "\n";
				this.accumulator.loadEnergies(energiesRaw
													.replaceAll(/\s+/g, "\n")
													.split("\n")
													.map((line) => Number.parseFloat(line)));
			}
			catch(error: unknown) {
				sendAlertMessage(`Error reading energy file: ${(error as Error).message}`, "fingerprints");
			}
		};

        this.enableEnergyFiltering = params.enableEnergyFiltering as boolean ?? false;
        this.thresholdFromMinimum = params.thresholdFromMinimum as boolean ?? false;
        this.energyThreshold = params.energyThreshold as number ?? 0;

		if(this.accumulator.size() === 0) return {
			countSelected: 0,
			countAccumulated: 0,
			energyThresholdEffective: this.accumulator.filtered().threshold
		};

		const status = this.accumulator.filterOnEnergy(this.enableEnergyFiltering,
														this.energyThreshold,
														this.thresholdFromMinimum);
		if(status.error) {
			sendAlertMessage(status.error, "fingerprints");
			return {
				countSelected: 0,
				countAccumulated: this.accumulator.size(),
				energyThresholdEffective: status.threshold
			};
		}
		return {
			countSelected: status.countSelected,
			countAccumulated: this.accumulator.size(),
			energyThresholdEffective: status.threshold,
		};
	}

	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelFP(params: CtrlParams): CtrlParams {

		void params;
		return {
			resultDimensionality: 123 // TBD
		};
	}
}
