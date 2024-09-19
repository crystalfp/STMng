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
import type {Structure, UiInfo, CtrlParams, ChannelDefinition} from "@/types";

export class ComputeFingerprints extends NodeCore {

	private structure: Structure | undefined;
	private readonly accumulator: Structure[] = [];

    private enableEnergyThreshold = false;
	private thresholdFromMinimum = false;
    private minimumEnergy = 0;
    private energyThreshold = 0;
	private energyPerStructure: number[] = [];
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
		{name: "energy",    type: "invoke", callback: this.channelEnergy.bind(this)},
		{name: "threshold", type: "invoke", callback: this.channelThreshold.bind(this)},
		{name: "fp",		type: "invoke", callback: this.channelFP.bind(this)},
		{name: "change",    type: "send",   callback: this.channelChange.bind(this)},
		{name: "reset",     type: "send",   callback: this.channelReset.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	override notifier(data: Structure): void {

		this.structure = data;
		if(!this.structure) return;

		// Find the energy threshold
		const threshold = this.thresholdFromMinimum ?
								this.minimumEnergy + this.energyThreshold :
								this.energyThreshold;

		// If in accumulate mode, save the structure encoded
		if(this.fingerprintsAccumulate) {

			this.accumulator.push(structuredClone(this.structure));

				// Do filtering
				const countSelected = this.filterOnEnergy(threshold);
				if(countSelected < 0) {
					sendAlertMessage("Energies are less than structures", "fingerprints");
					sendToClient(this.id, "load", {
						countSelected: 0,
						countAccumulated: this.accumulator.length,
						energyThresholdEffective: threshold,
					});
					return;
				}
				sendToClient(this.id, "load", {
					countSelected,
					countAccumulated: this.accumulator.length,
					energyThresholdEffective: threshold,
				});
		}
		else {
			sendToClient(this.id, "load", {
				countSelected: this.accumulator.length,
				countAccumulated: this.accumulator.length,
				energyThresholdEffective: threshold,
			});
		}
	}

	saveStatus(): string {
        const statusToSave = {
			enableEnergyThreshold: this.enableEnergyThreshold,
			energyThreshold: this.energyThreshold,
			thresholdFromMinimum: this.thresholdFromMinimum,
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		this.enableEnergyThreshold = params.enableEnergyThreshold as boolean ?? false;
		this.thresholdFromMinimum = params.thresholdFromMinimum as boolean ?? false;
		this.energyThreshold = params.energyThreshold as number ?? 0;
	}

	getUiInfo(): UiInfo {
		return {
			id: this.id,
			ui: "ComputeFingerprintsCtrl",
			graphic: "none",
			channels: this.channels.map((channel) => channel.name)
		};
	}

	/**
	 * Filter the list of accumulated structure by energy
	 *
	 * @returns The number of selected structures or -1 if the energies values
	 *			are less than the number of accumulated structures
	 */
	private filterOnEnergy(thresholdEnergy: number): number {

		const len = this.accumulator.length;
		if(this.enableEnergyThreshold) {

			if(this.energyPerStructure.length < len) return -1;

			let countSelected = 0;
			for(let i=0; i < len; ++i) if(this.energyPerStructure[i] <= thresholdEnergy) ++countSelected;

			return countSelected;
		}
		return len;
	};

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {};
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
	 * Channel handler for symmetry parameters change
	 *
	 * @returns Computed symmetry
	 */
	private channelReset(): void {
		this.accumulator.length = 0;
	}

	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelEnergy(params: CtrlParams): CtrlParams {

		const filename = params.filename as string;
		if(!filename) return {
			countSelected: this.accumulator.length,
			countAccumulated: this.accumulator.length,
			energyThresholdEffective: 0,
		};

        this.enableEnergyThreshold = params.enableEnergyThreshold as boolean ?? false;
        this.thresholdFromMinimum = params.thresholdFromMinimum as boolean ?? false;
        this.energyThreshold = params.energyThreshold as number ?? 0;

		try {
			const energiesRaw = fs.readFileSync(filename, "utf8") + "\n";
			this.energyPerStructure = energiesRaw
											.replaceAll(/\s+/g, "\n")
											.split("\n")
											.map((line) => Number.parseFloat(line));

			// Find the minimum energy
			this.minimumEnergy = Number.POSITIVE_INFINITY;
			for(const oneEnergy of this.energyPerStructure) {
				if(oneEnergy < this.minimumEnergy) this.minimumEnergy = oneEnergy;
			}

			// Find the energy threshold
			const threshold = this.thresholdFromMinimum ?
								this.minimumEnergy + this.energyThreshold :
								this.energyThreshold;

			// Do nothing if no structures
			if(this.accumulator.length === 0) {
				return {
					countSelected: 0,
					countAccumulated: 0,
					energyThresholdEffective: threshold,
				};
			}

			// Structures should be filtered by energy
			if(this.enableEnergyThreshold) {

				// Do filtering
				const countSelected = this.filterOnEnergy(threshold);
				if(countSelected < 0) {
					sendAlertMessage("Energies are less than structures", "fingerprints");
					return {
						countSelected: 0,
						countAccumulated: this.accumulator.length,
						energyThresholdEffective: threshold,
					};
				}
				return {
					countSelected,
					countAccumulated: this.accumulator.length,
					energyThresholdEffective: threshold,
				};
			}
		}
		catch(error: unknown) {
			sendAlertMessage(`Error reading energy file: ${(error as Error).message}`, "fingerprints");
		}
		return {
			countSelected: this.accumulator.length,
			countAccumulated: this.accumulator.length,
			energyThresholdEffective: this.energyThreshold,
		};
	}

	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelThreshold(params: CtrlParams): CtrlParams {

        this.enableEnergyThreshold = params.enableEnergyThreshold as boolean ?? false;
        this.thresholdFromMinimum = params.thresholdFromMinimum as boolean ?? false;
        this.energyThreshold = params.energyThreshold as number ?? 0;
        this.fingerprintsAccumulate = params.fingerprintsAccumulate as boolean ?? false;

		// Find the energy threshold
		const threshold = this.thresholdFromMinimum ?
								this.minimumEnergy + this.energyThreshold :
								this.energyThreshold;

		// If in accumulate mode, save the structure encoded
		if(this.fingerprintsAccumulate) {

			// Do filtering
			const countSelected = this.filterOnEnergy(threshold);
			if(countSelected < 0) {
				sendAlertMessage("Energies are less than structures", "fingerprints");
				return {
					countSelected: 0,
					countAccumulated: this.accumulator.length,
					energyThresholdEffective: threshold,
				};
			}
			return {
				countSelected,
				countAccumulated: this.accumulator.length,
				energyThresholdEffective: threshold,
			};
		}
		return {
			countSelected: this.accumulator.length,
			countAccumulated: this.accumulator.length,
			energyThresholdEffective: threshold,
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
