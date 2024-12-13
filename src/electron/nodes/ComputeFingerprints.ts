/**
 * Compute fingerprints for an accumulated set of structures.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import {readFileSync} from "node:fs";
import {NodeCore} from "../modules/NodeCore";
import {sendAlertMessage, sendToClient} from "../modules/WindowsUtilities";
import {FingerprintsAccumulator} from "../fingerprint/Accumulator";
import {Fingerprinting} from "../fingerprint/Compute";
import type {Structure, CtrlParams, ChannelDefinition} from "@/types";

export class ComputeFingerprints extends NodeCore {

	private structure: Structure | undefined;
	private readonly accumulator = new FingerprintsAccumulator();
	private readonly fp = new Fingerprinting();

    private enableEnergyFiltering = false;
	private thresholdFromMinimum = false;
    private energyThreshold = 0;
	private fingerprintsAccumulate = false;
	private areNanoclusters = false;

	private forceCutoff = false;
	private manualCutoffDistance = 10;
	private cutoffDistance = 0;

	private selectedMethod = 0;
	private binSize = 0.05;
	private peakWidth = 0.02;

	// private selectDistanceMethod = 0;
	// private fixTriangleInequality = false;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",      type: "invoke", callback: this.channelInit.bind(this)},
		{name: "capture",   type: "invoke", callback: this.channelCapture.bind(this)},
		{name: "reset",     type: "send",   callback: this.channelReset.bind(this)},
		{name: "energy",    type: "invoke", callback: this.channelEnergy.bind(this)},
		{name: "cutoff",    type: "invoke", callback: this.channelCutoff.bind(this)},
		{name: "fp",		type: "invoke", callback: this.channelFP.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	override fromPreviousNode(data: Structure): void {

		this.structure = data;
		if(!this.structure) return;

		// If in accumulate mode, save the structure
		if(this.fingerprintsAccumulate) {

			try {
				this.areNanoclusters = this.accumulator.add(this.structure, this.areNanoclusters);
			}
			catch(error: unknown) {
				sendAlertMessage((error as Error).message, "fingerprints");
			}
			this.doFiltering();
		}
		else {
			this.setCutoffDistance();

			sendToClient(this.id, "load", {
				countSelected: this.accumulator.selectedSize(),
				countAccumulated: this.accumulator.size(),
				energyThresholdEffective: this.energyThreshold,
				cutoffDistance: this.setCutoffDistance(),
				areNanoclusters: this.areNanoclusters
			});
		}
	}

	/**
	 * Compute cutoff distance
	 *
	 * @returns The cutoff distance (already set in this.cutoffDistance)
	 */
	private setCutoffDistance(): number {

		this.cutoffDistance = this.forceCutoff ?
										this.manualCutoffDistance :
										this.accumulator.getCutoffDistance();
		return this.cutoffDistance;
	}

	/**
	 * Filters on energy the list of structures accumulated
	 */
	private doFiltering(): void {

		const status = this.accumulator.filterOnEnergy(this.enableEnergyFiltering,
													   this.energyThreshold,
													   this.thresholdFromMinimum);
		if(status.error) {
			sendAlertMessage(status.error, "fingerprints");
			sendToClient(this.id, "load", {
				countSelected: 0,
				countAccumulated: this.accumulator.size(),
				energyThresholdEffective: status.threshold,
				cutoffDistance: 0,
				areNanoclusters: this.areNanoclusters
			});
		}
		else {

			sendToClient(this.id, "load", {
				countSelected: status.countSelected,
				countAccumulated: this.accumulator.size(),
				energyThresholdEffective: status.threshold,
				cutoffDistance: this.setCutoffDistance(),
				areNanoclusters: this.areNanoclusters
			});
		}
	}

	// > Load/save status
	saveStatus(): string {
        const statusToSave = {
			enableEnergyFiltering: this.enableEnergyFiltering,
			energyThreshold: this.energyThreshold,
			thresholdFromMinimum: this.thresholdFromMinimum,
			areNanoclusters: this.areNanoclusters,
        	selectedMethod: this.selectedMethod,
        	binSize: this.binSize,
        	peakWidth: this.peakWidth,
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		this.enableEnergyFiltering = params.enableEnergyFiltering as boolean ?? false;
		this.thresholdFromMinimum = params.thresholdFromMinimum as boolean ?? false;
		this.energyThreshold = params.energyThreshold as number ?? 0;
        this.areNanoclusters = params.areNanoclusters as boolean ?? false;
        this.selectedMethod = params.selectedMethod as number ?? 0;
        this.binSize = params.binSize as number ?? 0.05;
        this.peakWidth = params.peakWidth as number ?? 0.02;
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
        	areNanoclusters: this.areNanoclusters,

			forceCutoff: this.forceCutoff,
			manualCutoffDistance: this.manualCutoffDistance,

			fingerprintMethods: JSON.stringify(this.fp.getFingerprintMethodsNames()),
			selectedMethod: this.selectedMethod,
			binSize: this.binSize,
			peakWidth: this.peakWidth,

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
		this.areNanoclusters = params.areNanoclusters as boolean ?? false;

		if(this.fingerprintsAccumulate && this.structure) {

			try {
				this.areNanoclusters = this.accumulator.add(this.structure, this.areNanoclusters);
			}
			catch(error: unknown) {
				sendAlertMessage((error as Error).message, "fingerprints");
			}

			const status = this.accumulator.filterOnEnergy(this.enableEnergyFiltering,
														   this.energyThreshold,
														   this.thresholdFromMinimum);
			if(status.error) {
				sendAlertMessage(status.error, "fingerprints");
				return {
					countSelected: 0,
					countAccumulated: this.accumulator.size(),
					energyThresholdEffective: status.threshold,
					cutoffDistance: 0,
					areNanoclusters: this.areNanoclusters
				};
			}

			return {
				countSelected: status.countSelected,
				countAccumulated: this.accumulator.size(),
				energyThresholdEffective: status.threshold,
				cutoffDistance: this.setCutoffDistance(),
				areNanoclusters: this.areNanoclusters
			};
		}

		return {
		    countSelected: this.accumulator.filtered().countSelected,
        	countAccumulated: this.accumulator.size(),
			energyThresholdEffective: this.energyThreshold,
			cutoffDistance: this.setCutoffDistance(),
			areNanoclusters: this.areNanoclusters
		};
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
				const energiesRaw = readFileSync(filename, "utf8") + "\n";
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

		if(this.accumulator.selectedSize() === 0) return {
			countSelected: 0,
			countAccumulated: 0,
			energyThresholdEffective: this.accumulator.filtered().threshold,
			cutoffDistance: 0
		};

		const status = this.accumulator.filterOnEnergy(this.enableEnergyFiltering,
														this.energyThreshold,
														this.thresholdFromMinimum);
		if(status.error) {
			sendAlertMessage(status.error, "fingerprints");
			return {
				countSelected: 0,
				countAccumulated: this.accumulator.size(),
				energyThresholdEffective: status.threshold,
				cutoffDistance: 0
			};
		}

		return {
			countSelected: status.countSelected,
			countAccumulated: this.accumulator.size(),
			energyThresholdEffective: status.threshold,
			cutoffDistance: this.setCutoffDistance()
		};
	}

	/**
	 * Channel handler for starting fingerprinting
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelCutoff(params: CtrlParams): CtrlParams {

        this.forceCutoff = params.forceCutoff as boolean ?? false;
        this.manualCutoffDistance = params.manualCutoffDistance as number ?? 10;

		return {
			cutoffDistance: this.setCutoffDistance()
		};
	}

	/**
	 * Channel handler for doing fingerprinting
	 *
	 * @returns Results for the user interface
	 */
	private channelFP(params: CtrlParams): CtrlParams {

		this.selectedMethod = params.selectedMethod as number ?? 0;
        this.binSize = params.binSize as number ?? 0.05;
        this.peakWidth = params.peakWidth as number ?? 0.02;

		const result = this.fp.compute(this.accumulator, {
			method: this.selectedMethod,
			areNanoclusters: this.areNanoclusters,
			cutoffDistance: this.cutoffDistance,
			binSize: this.binSize,
			peakWidth: this.peakWidth
		});

		if(result.error) {
			sendAlertMessage(result.error, "fingerprints");
		}

		return {
			resultDimensionality: result.dimension
		};
	}
}
