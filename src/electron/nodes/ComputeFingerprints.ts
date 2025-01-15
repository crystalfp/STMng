/**
 * Compute fingerprints for an accumulated set of structures.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import {ipcMain} from "electron";
import {readFileSync, writeFileSync} from "node:fs";
import {NodeCore} from "../modules/NodeCore";
import {createSecondaryWindowWithRetry, isSecondaryWindowOpen, sendAlertMessage,
		sendToClient, sendToSecondaryWindow} from "../modules/WindowsUtilities";
import {FingerprintsAccumulator, type StructureReduced} from "../fingerprint/Accumulator";
import {Fingerprinting} from "../fingerprint/Compute";
import {Distances} from "../fingerprint/Distances";
import {Grouping} from "../fingerprint/Grouping";
import {WriterPOSCAR} from "../writers/WritePOSCAR";
import {getAtomicSymbol} from "../modules/AtomData";
import {scatterToUniform} from "../fingerprint/ScatterToUniform";
import type {Structure, Atom, CtrlParams, ChannelDefinition, ScatterplotData,
			 EnergyLandscapeData, PositionType} from "@/types";

export class ComputeFingerprints extends NodeCore {

	private structure: Structure | undefined;
	private readonly accumulator = new FingerprintsAccumulator();
	private readonly fp = new Fingerprinting();
	private readonly dist = new Distances();
	private readonly grouping = new Grouping();

    private enableEnergyFiltering = false;
	private thresholdFromMinimum = false;
    private energyThreshold = 0;
	private fingerprintsAccumulate = false;
	private areNanoclusters = false;

	private forceCutoff = false;
	private manualCutoffDistance = 10;
	private cutoffDistance = 0;

	private fingerprintingMethod = 0;
	private binSize = 0.05;
	private peakWidth = 0.02;

	private distanceMethod = 0;
	private fixTriangleInequality = false;
	private distanceMin = 0;
	private distanceMax = 10;

	private groupingMethod = 0;
	private groupingThreshold = 5;
	private addedMargin = 0;

	private channelOpened = false;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",      	type: "invoke", callback: this.channelInit.bind(this)},
		{name: "capture",   	type: "invoke", callback: this.channelCapture.bind(this)},
		{name: "reset",     	type: "send",   callback: this.channelReset.bind(this)},
		{name: "energy",    	type: "invoke", callback: this.channelEnergy.bind(this)},
		{name: "cutoff",    	type: "invoke", callback: this.channelCutoff.bind(this)},
		{name: "fp",			type: "invoke", callback: this.channelFP.bind(this)},
		{name: "fp-params",		type: "send", 	callback: this.channelFPParams.bind(this)},
		{name: "dist",			type: "invoke", callback: this.channelDist.bind(this)},
		{name: "dist-params",	type: "send",	callback: this.channelDistParams.bind(this)},
		{name: "group",			type: "invoke",	callback: this.channelGroup.bind(this)},
		{name: "group-params",	type: "send",	callback: this.channelGroupParams.bind(this)},
		{name: "scatter",		type: "send",	callback: this.channelScatter.bind(this)},
		{name: "landscape",		type: "send",	callback: this.channelLandscape.bind(this)},
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
        	fingerprintingMethod: this.fingerprintingMethod,
        	binSize: this.binSize,
        	peakWidth: this.peakWidth,
			distanceMethod: this.distanceMethod,
			fixTriangleInequality: this.fixTriangleInequality,
			groupingMethod: this.groupingMethod,
			groupingThreshold: this.groupingThreshold,
			addedMargin: this.addedMargin,
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		this.enableEnergyFiltering = params.enableEnergyFiltering as boolean ?? false;
		this.thresholdFromMinimum = params.thresholdFromMinimum as boolean ?? false;
		this.energyThreshold = params.energyThreshold as number ?? 0;
        this.areNanoclusters = params.areNanoclusters as boolean ?? false;
        this.fingerprintingMethod = params.fingerprintingMethod as number ?? 0;
        this.binSize = params.binSize as number ?? 0.05;
        this.peakWidth = params.peakWidth as number ?? 0.02;
		this.distanceMethod = params.distanceMethod as number ?? 0;
		this.fixTriangleInequality = params.fixTriangleInequality as boolean ?? false;
		this.groupingMethod = params.groupingMethod as number ?? 0;
		this.groupingThreshold = params.groupingThreshold as number ?? 0;
		this.addedMargin = params.addedMargin as number ?? 0;
	}

	/**
	 * Prepare the data for the scatterplot
	 *
	 * @param mappedPoints - Points mapped in 2D
	 * @returns Data needed by the scatterplot
	 */
	private packDataForClient(mappedPoints: number[][]): ScatterplotData {

		// How many structures are we dealing with
		const n = mappedPoints.length;

		// Compare projected distances with the original ones
		const distanceMatrix = this.dist.getDistanceMatrix();
		const efficiencies: [number, number][] = [];
		for(let row=0; row < n-1; ++row) {
			for(let col=row+1; col < n; ++col) {

				const distanceOriginal = distanceMatrix.get(row, col);

				const distanceProjected = Math.hypot(
					mappedPoints[row][0]-mappedPoints[col][0],
					mappedPoints[row][1]-mappedPoints[col][1]
				);

				efficiencies.push([distanceOriginal, distanceProjected]);
			}
		}

		// Normalize original and projected distances
		let minX = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		for(const eff of efficiencies) {

			if(eff[0] > maxX) maxX = eff[0];
			if(eff[0] < minX) minX = eff[0];
			if(eff[1] > maxY) maxY = eff[1];
			if(eff[1] < minY) minY = eff[1];
		}

		let denX = maxX - minX;
		if(denX < 1e-10) denX = 1;
		let denY = maxY - minY;
		if(denY < 1e-10) denY = 1;

		for(const eff of efficiencies) {
			eff[0] = (eff[0]-minX)/denX;
			eff[1] = (eff[1]-minY)/denY;
		}

		// Collect energies and ids per structure
		const energies = [];
		const ids = [];
		for(const structure of this.accumulator.iterateSelectedStructures()) {
			if(structure.energy !== undefined) energies.push(structure.energy);
			ids.push(structure.index);
		}

		// Collect groups
		const groups = this.grouping.getGroups();
		const countGroups = this.grouping.getCountGroups();
		const silhouettes = this.grouping.computeSilhouetteCoefficients(distanceMatrix);

		// Create data for the scatterplot
		return {
			id: ids,
			points: mappedPoints,
			groups,
			countGroups,
			energies,
			efficiencies,
			silhouettes
		};
	}

	/**
	 * Open or update the scatterplot window
	 *
	 * @param opKind - Operation to be performed: "no-group" only distances available,
	 *                 "update" update if scatter available or "create" create the scatterplot
	 */
	private createUpdateScatterplot(opKind: "no-group" | "update" | "create"): void {

		const scatterplotOpen = isSecondaryWindowOpen("/scatter");
		if(opKind !== "create" && !scatterplotOpen) return;

		// Take the points projected to 2D
		const points = this.dist.getProjectedPoints();

		// Collect the data for the scatterplot
		const scatterplotData = this.packDataForClient(points);
		if(opKind === "no-group") {
			scatterplotData.groups = [];
			scatterplotData.countGroups = 0;
		}
		const dataToSend = JSON.stringify(scatterplotData);

		// If it is open, update the scatterplot window
		if(scatterplotOpen) {

			sendToSecondaryWindow("/scatter", dataToSend);
		}
		else {

			// Create the scatterplot window
			createSecondaryWindowWithRetry({
				routerPath: "/scatter",
				width: 1200,
				height: 900,
				title: "Fingerprints scatterplot",
				data: dataToSend
			});
		}
	}

	/**
	 * Open or update the energy landscape window
	 *
	 * @param opKind - Operation to be performed:
	 *                 "update" update if scatter available or "create" create the landscape
	 */
	private createUpdateLandscape(opKind: "update" | "create"): void {

		const landscapeOpen = isSecondaryWindowOpen("/landscape");
		if(opKind !== "create" && !landscapeOpen) return;

		// Collect energies per structure
		const energies = [];
		for(const structure of this.accumulator.iterateSelectedStructures()) {
			if(structure.energy === undefined) return;
			energies.push(structure.energy);
		}

		// Normalize between 0 and 1
		let minEnergy = Number.POSITIVE_INFINITY;
		let maxEnergy = Number.NEGATIVE_INFINITY;
		for(const energy of energies) {
			if(energy < minEnergy) minEnergy = energy;
			if(energy > maxEnergy) maxEnergy = energy;
		}
		for(let i=0; i < energies.length; ++i) {
			energies[i] = (energies[i] - minEnergy) / (maxEnergy - minEnergy);
		}

		// Take the distance matrix and project it in 2D
		const points = this.dist.getProjectedPoints();

		// TBD Get the parameters for the interpolation
		const gridSide = 128;
		const power = 2;

		// Interpolate the scatter points to a regular grid and send to client
		const grid = scatterToUniform(gridSide, points, energies, power);
		const energyLandscapeData: EnergyLandscapeData = {
			grid,
			side: gridSide
		};
		const dataToSend = JSON.stringify(energyLandscapeData);

		// If it is open, update the energy landscape window
		if(landscapeOpen) {

			sendToSecondaryWindow("/landscape", dataToSend);
		}
		else {

			// Create the energy landscape window
			createSecondaryWindowWithRetry({
				routerPath: "/landscape",
				width: 1200,
				height: 900,
				title: "Fingerprints energy landscape",
				data: dataToSend
			});
		}
	}

	/**
	 * Convert an accumulated structure to a Structure type for writing to file
	 *
	 * @param structure - One structure from the accumulator
	 * @returns - The structure as a Structure type
	 */
	convertAccumulatedStructure(structure: StructureReduced): Structure {

		const natoms = structure.atomsZ.length;
		const atoms: Atom[] = [];
		for(let i=0; i < natoms; ++i) {

			atoms.push({
				atomZ: structure.atomsZ[i],
				label: getAtomicSymbol(structure.atomsZ[i]),
				position: [
					structure.atomsPosition[3*i],
					structure.atomsPosition[3*i+1],
					structure.atomsPosition[3*i+2],
				]
			});
		}
		return {

			crystal: {
				basis: structure.basis,
				origin: [0, 0, 0] as PositionType,
				spaceGroup: "",
			},
			atoms,
			bonds: [],
			volume: [],
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

			enableEnergyFiltering: this.enableEnergyFiltering,
			thresholdFromMinimum: this.thresholdFromMinimum,
			energyThreshold: this.energyThreshold,
			energyThresholdEffective: this.accumulator.filtered().threshold,
        	areNanoclusters: this.areNanoclusters,

			forceCutoff: this.forceCutoff,
			manualCutoffDistance: this.manualCutoffDistance,

			fingerprintMethods: JSON.stringify(this.fp.getFingerprintMethodsNames()),
			fingerprintingMethod: this.fingerprintingMethod,
			binSize: this.binSize,
			peakWidth: this.peakWidth,

			distanceMethods: JSON.stringify(this.dist.getDistancesMethodsNames()),
			distanceMethod: this.distanceMethod,
			fixTriangleInequality: this.fixTriangleInequality,

			groupingMethods: JSON.stringify(this.grouping.getGroupingMethodsNames()),
			groupingMethod: this.groupingMethod,
			groupingThreshold: this.groupingThreshold,
			addedMargin: this.addedMargin,
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
	 * Channel handler for changing cutoff distance
	 *
	 * @returns The computed cutoff distance
	 */
	private channelCutoff(params: CtrlParams): CtrlParams {

        this.forceCutoff = params.forceCutoff as boolean ?? false;
        this.manualCutoffDistance = params.manualCutoffDistance as number ?? 10;

		return {
			cutoffDistance: this.setCutoffDistance()
		};
	}

	/**
	 * Channel handler for fingerprinting parameters change
	 *
	 * @param params - Parameters from the UI
	 */
	private channelFPParams(params: CtrlParams): void {

		this.fingerprintingMethod = params.fingerprintingMethod as number ?? 0;
        this.binSize = params.binSize as number ?? 0.05;
        this.peakWidth = params.peakWidth as number ?? 0.02;
	}

	/**
	 * Channel handler for fingerprinting
	 *
	 * @param params - Fingerprinting computation parameters
	 * @returns Results for the user interface
	 */
	private channelFP(params: CtrlParams): CtrlParams {

		this.fingerprintingMethod = params.fingerprintingMethod as number ?? 0;
        this.binSize = params.binSize as number ?? 0.05;
        this.peakWidth = params.peakWidth as number ?? 0.02;

		const result = this.fp.compute(this.accumulator, {
			method: this.fingerprintingMethod,
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

	/**
	 * Channel handler for distance computation parameters change
	 *
	 * @param params - Parameters from the UI
	 */
	private channelDistParams(params: CtrlParams): void {

		this.distanceMethod = params.distanceMethod as number ?? 0;
		this.fixTriangleInequality = params.fixTriangleInequality as boolean ?? false;
	}

	/**
	 * Channel handler for compute distances
	 *
	 * @param params - Distance computation parameters
	 * @returns Results for the user interface
	 */
	private channelDist(params: CtrlParams): CtrlParams {

		this.distanceMethod = params.distanceMethod as number ?? 0;
		this.fixTriangleInequality = params.fixTriangleInequality as boolean ?? false;

		const result = this.dist.measureAll(this.accumulator,
											this.distanceMethod,
											this.fixTriangleInequality);

		if(result.error) sendAlertMessage(result.error, "fingerprints");

		// Save distance range
		this.distanceMin = result.distanceMin;
		this.distanceMax = result.distanceMax;

		// Project points to 2D
		this.dist.projectPoints();

		// Update the scatterplot if it is open
		this.createUpdateScatterplot("no-group");

		return {countDistances: result.countDistances, endMessage: result.endMessage};
	}

	/**
	 * Channel handler for grouping parameters change
	 *
	 * @param params - Parameters from the UI
	 */
	private channelGroupParams(params: CtrlParams): void {

		this.groupingMethod = params.groupingMethod as number ?? 0;
        this.groupingThreshold = params.groupingThreshold as number ?? 50;
        this.addedMargin = params.addedMargin as number ?? 0;
	}

	/**
	 * Channel handler for computing grouping
	 *
	 * @param params - Parameters from the UI
	 * @returns Computation results for the UI
	 */
	private channelGroup(params: CtrlParams): CtrlParams {

		this.groupingMethod = params.groupingMethod as number ?? 0;
        this.groupingThreshold = params.groupingThreshold as number ?? 50;
        this.addedMargin = params.addedMargin as number ?? 0;

		// Transform percentage into absolute threshold value
		const threshold = this.distanceMin + this.groupingThreshold/100*(this.distanceMax-this.distanceMin);

		const result = this.grouping.group(this.accumulator, this.dist.getDistanceMatrix(),
										   this.groupingMethod, threshold, this.addedMargin);

		if(result.error) sendAlertMessage(result.error, "fingerprints");

		// Update the scatterplot if it is open
		this.createUpdateScatterplot("update");

		return {countGroups: result.countGroups};
	}

	/**
	 * Channel handler for opening scatterplot on the results
	 */
	private channelScatter(): void {

		this.createUpdateScatterplot("create");

		if(!this.channelOpened) {
			this.channelOpened = true;

			ipcMain.on("SYSTEM:selected-points", (_event: unknown, params: CtrlParams): void => {

				const points = params.points as string;
				if(!points)	return;
				const indices = JSON.parse(params.points as string) as number[];
				if(indices.length === 0) return;
				const filename = params.filename as string;
				if(!filename) return;

				const structures: Structure[] = [];
				const energies: number[] = [];
				let idx = 0;
				for(const structure of this.accumulator.iterateSelectedStructures()) {
					if(indices.includes(idx)) {
						structures.push(this.convertAccumulatedStructure(structure));
						if(structure.energy) energies.push(structure.energy);
					}
					++idx;
				}

				if(structures.length === 0) return;
				const writer = new WriterPOSCAR();
				const sts = writer.writeStructure(filename, structures);

				if(sts.error) sendAlertMessage(sts.error as string, "fingerprints");

        		const pos = filename.lastIndexOf(".");
				const energyFilename = pos > 0 ? `${filename.slice(pos+1)}.energy` : `${filename}.energy`;

				writeFileSync(energyFilename, energies.join("\n"), "utf8");
			});
		}
	}

	/**
	 * Channel handler for opening energy surface display
	 */
	private channelLandscape(): void {
		// TBD
		this.createUpdateLandscape("create");

	}
}
