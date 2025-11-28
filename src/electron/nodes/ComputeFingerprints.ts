/**
 * Compute fingerprints for an accumulated set of structures.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-09
 */
import {ipcMain} from "electron";
import {writeFileSync} from "node:fs";
import {NodeCore} from "../modules/NodeCore";
import {createOrUpdateSecondaryWindow, isSecondaryWindowOpen} from "../modules/WindowsUtilities";
import {sendAlertToClient, sendToClient} from "../modules/ToClient";
import {FingerprintsAccumulator, type StructureReduced} from "../fingerprint/Accumulator";
import {Fingerprinting} from "../fingerprint/Compute";
import {Distances} from "../fingerprint/Distances";
import {Grouping} from "../fingerprint/Grouping";
import {normalizeCoordinates2D} from "../fingerprint/Helpers";
import {methodDistances, methodDistancesHistogram, methodEnergiesHistogram,
		methodEnergyDistance, methodOrder} from "../fingerprint/Analysis";
import {getAtomData, getAtomicSymbol} from "../modules/AtomData";
import {generalizedConvexHull4D} from "../fingerprint/GeneralizedConvexHull";
import {removeDuplicatePoints} from "../fingerprint/RemoveDuplicates";
import {embeddedDimensionEstimator} from "../fingerprint/DimensionEstimation";
import type {Structure, Atom, CtrlParams, ChannelDefinition,
			 EnergyLandscapeData, PositionType,
			 FingerprintsChartData, FingerprintsChartKind,
			 ScatterplotData, PlotKind} from "@/types";

import {WriterPOSCAR} from "../writers/WritePOSCAR";

/**
 * Options for the scatterplot creation
 * @notExported
 */
interface CreateUpdateScatterplotOptions {

	/** Kind of plot for which the data should be provided */
	plotType?: PlotKind;

	/** True if the group are not provided */
	noGroups?: boolean;

	/** Updated list of selected points */
	selectedPoints?: number[];
}

/**
 * The auxiliary array item to sort structures on energy
 * @notExported
 */
interface SorterItem {

	/** Index of the structure in the structures array */
	idx: number;

	/** Corresponding energy by atom */
	energy: number;

	/** Energy to be written to the output file (could be by atom or by structure) */
	outEnergy: number;
}

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
	private processParallelism = false;

	private distanceMethod = 0;
	private fixTriangleInequality = false;

	private groupingMethod = 0;
	private groupingThreshold = 0.1;
	private addedMargin = 0;

	private removeDuplicates = true;
	private duplicatesThreshold = 0.015;

	private plotType: PlotKind = "group";

	private chartType: FingerprintsChartKind = "fp";
	private lambda = 0;

	private static channelOpened = false;
	private channelChartsOpened = false;
	private channelExportOpened = false;

	private readonly fingerprintMethodsNames = [
		"Oganov-Valle fingerprint",
		"Oganov-Valle per-site fingerprint",
		"Dot-matrix fingerprint"
	];

	private readonly channels: ChannelDefinition[] = [
		{name: "init",      	type: "invoke", callback: this.channelInit.bind(this)},
		{name: "capture",   	type: "invoke", callback: this.channelCapture.bind(this)},
		{name: "reset",     	type: "send",   callback: this.channelReset.bind(this)},
		{name: "energy",    	type: "invoke", callback: this.channelEnergy.bind(this)},
		{name: "cutoff",    	type: "invoke", callback: this.channelCutoff.bind(this)},
		{name: "fp",			type: "invokeAsync", callback: this.channelFP.bind(this)},
		{name: "fp-params",		type: "send", 	callback: this.channelFPParams.bind(this)},
		{name: "dist",			type: "invoke", callback: this.channelDist.bind(this)},
		{name: "duplicates",	type: "invoke",	callback: this.channelDuplicates.bind(this)},
		{name: "group",			type: "invoke",	callback: this.channelGroup.bind(this)},
		{name: "group-params",	type: "send",	callback: this.channelGroupParams.bind(this)},
		{name: "scatter",		type: "invoke",	callback: this.channelScatter.bind(this)},
		{name: "landscape",		type: "send",	callback: this.channelLandscape.bind(this)},
		{name: "charts",		type: "send",	callback: this.channelCharts.bind(this)},
		{name: "export",		type: "send",	callback: this.channelExport.bind(this)},
	];

	/**
	 * Create the node
	 *
	 * @param id - The node ID
	 */
	constructor(id: string) {
		super(id);
		this.setupChannels(id, this.channels);
	}

	/**
	 * Add one structure to accumulator
	 *
	 * @param structure - Structure to be added to the accumulator
	 */
	private addToAccumulator(structure: Structure): void {

		try {
			this.areNanoclusters = this.accumulator.add(structure, this.areNanoclusters);
		}
		catch(error: unknown) {
			sendAlertToClient((error as Error).message, {node: "fingerprints"});
		}
		sendToClient(this.id, "has-energies", {
			haveEnergies: this.accumulator.accumulatedHaveEnergies()
		});
	}

	override fromPreviousNode(data: Structure): void {

		this.structure = data;
		if(!this.structure) return;

		// If in accumulate mode, save the structure
		if(this.fingerprintsAccumulate) {

			this.addToAccumulator(this.structure);
			this.doFiltering();
		}
		else {

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
			sendAlertToClient(status.error, {node: "fingerprints"});
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
			forceCutoff: this.forceCutoff,
			manualCutoffDistance: this.manualCutoffDistance,
        	fingerprintingMethod: this.fingerprintingMethod,
        	binSize: this.binSize,
        	peakWidth: this.peakWidth,
			distanceMethod: this.distanceMethod,
			fixTriangleInequality: this.fixTriangleInequality,
			groupingMethod: this.groupingMethod,
			groupingThreshold: this.groupingThreshold,
			addedMargin: this.addedMargin,
			removeDuplicates: this.removeDuplicates,
			duplicatesThreshold: this.duplicatesThreshold,
			processParallelism: this.processParallelism
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		this.enableEnergyFiltering = params.enableEnergyFiltering as boolean ?? false;
		this.thresholdFromMinimum = params.thresholdFromMinimum as boolean ?? false;
		this.energyThreshold = params.energyThreshold as number ?? 0;
        this.areNanoclusters = params.areNanoclusters as boolean ?? false;
		this.forceCutoff = params.forceCutoff as boolean ?? false;
		this.manualCutoffDistance = params.manualCutoffDistance as number ?? 10;
        this.fingerprintingMethod = params.fingerprintingMethod as number ?? 0;
		if(this.fingerprintingMethod >= this.fingerprintMethodsNames.length ||
		   this.fingerprintingMethod < 0) this.fingerprintingMethod = 0;
        this.binSize = params.binSize as number ?? 0.05;
        this.peakWidth = params.peakWidth as number ?? 0.02;
		this.distanceMethod = params.distanceMethod as number ?? 0;
		this.fixTriangleInequality = params.fixTriangleInequality as boolean ?? false;
		this.groupingMethod = params.groupingMethod as number ?? 0;
		this.groupingThreshold = params.groupingThreshold as number ?? 0.1;
		if(this.groupingThreshold > 1.8) this.groupingThreshold = 1.8;
		if(this.groupingThreshold < 0.01) this.groupingThreshold = 0.01;
		this.addedMargin = params.addedMargin as number ?? 0;
        this.removeDuplicates = params.removeDuplicates as boolean ?? true;
        this.duplicatesThreshold = params.duplicatesThreshold as number ?? 0.015;
		this.processParallelism = params.processParallelism as boolean ?? false;
	}

	/**
	 * Decimate points to represent their distribution
	 *
	 * @param points - The list of points as [x, y] tuples
	 * @param targetCount - The maximum number of points after decimation
	 * @returns The decimated list of points
	 */
	private static decimatePoints(points: number[][], targetCount: number): number[][] {

		if(points.length <= targetCount) return points;

		// Create a grid to count points in each cell
		const gridSide = Math.ceil(Math.sqrt(targetCount));
		const grid = Array<number[]>(gridSide * gridSide);

		// Assign one representative point to each grid cells
		for(const point of points) {

			const cellX = Math.floor(point[0] * (gridSide-1));
			const cellY = Math.floor(point[1] * (gridSide-1));
			const cellIndex = cellY * gridSide + cellX;
			if(!grid[cellIndex]) grid[cellIndex] = point;
		}

		// Collect points from each filled cell
		const decimatedPoints: [number, number][] = [];
		for(const cell of grid) {

			if(cell && cell.length > 0) decimatedPoints.push([cell[0], cell[1]]);
		}

		return decimatedPoints;
	}

	/**
	 * Prepare the data to visualize the mapping fidelity chart
	 *
	 * @param points - Points mapped in 2D
	 * @param enabled - List of enabled status for the points
	 * @returns Data needed by the scatterplot
	 */
	private prepareFidelityData(points: number[][], enabled: boolean[], hasEnergies: boolean): ScatterplotData {

		// How many structures are we dealing with
		const n = points.length;

		// Compare projected distances with the original ones
		let fidelities: number[][] = [];
		const distanceMatrix = this.dist.getDistanceMatrix();

		// For each distance between two enabled points
		for(let row=0; row < n-1; ++row) {

			if(!enabled[row]) continue;
			for(let col=row+1; col < n; ++col) {

				if(!enabled[col]) continue;

				const distanceOriginal = distanceMatrix.get(row, col);

				const distanceProjected = Math.hypot(
					points[row][0]-points[col][0],
					points[row][1]-points[col][1]
				);

				fidelities.push([distanceOriginal, distanceProjected]);
			}
		}

		// Normalize original and projected distances mapping points coordinates between 0 and 1
		fidelities = normalizeCoordinates2D(fidelities);

		// If too many points, decimate them to reduce the number to less than 20'000
		fidelities = ComputeFingerprints.decimatePoints(fidelities, 20_000);

		return {

			id: [],
			points: [],
			values: [],
			countGroups: this.grouping.getCountGroups(),
			hasEnergies,
			fidelity: fidelities
		};
	}

	/**
	 * Prepare the data to visualize the scatterplot chart
	 *
	 * @param points - Points mapped in 2D (ignoring enabled value)
	 * @param enabled - List of enabled status for the points
	 * @param options - Options for the scatterplot
	 * @param hasEnergies - If the accumulated structures have energies
	 * @returns Data needed by the scatterplot
	 * @throws Error.
	 * Invalid plot type
	 */
	private prepareScatterplotData(points: number[][],
								   enabled: boolean[],
								   options: CreateUpdateScatterplotOptions,
								   hasEnergies: boolean): ScatterplotData {

		// How many structures are we dealing with
		const n = points.length;

		// Get the total number of groups
		const noGroups = options.noGroups ?? false;
		const countGroups = noGroups ? 0 : this.grouping.getCountGroups();

		// Prepare data for the plot
		const values: number[] = [];
		switch(options.plotType) {
			case "group":
				if(!noGroups) {

					// Collect groups
					const groups = this.grouping.getGroups();
					for(let idx=0; idx < n; ++idx) {
						if(enabled[idx]) values.push(groups[idx]);
					}
				}
				break;
			case "energy":
				for(const structure of this.accumulator.iterateSelectedEnabledStructures()) {
					values.push(structure.energy ?? 0);
				}
				break;
			case "silhouette": {
					const silhouette =
						this.grouping.computeSilhouetteCoefficients(this.dist.getDistanceMatrix(),
																	enabled);
					for(const s of silhouette) values.push(s);
				}
				break;
			case "fidelity":
			case undefined:
				throw Error(`Invalid "${options.plotType}" plot type`);
		}

		// Id of the enabled structures
		const ids: number[] = [];
		const mappedPoints: number[][] = [];
		let idx = 0;
		for(const structure of this.accumulator.iterateSelectedStructures()) {
			if(structure.enabled) {
				ids.push(structure.step);
				mappedPoints.push(points[idx]);
			}
			++idx;
		}
		return {

			id: ids,
			points: mappedPoints,
			values,
			countGroups,
			hasEnergies,
			fidelity: []
		};
	}

	/**
	 * Open or update the scatterplot window
	 *
	 * @param opKind - Operation to be performed:
	 *                 "update" update if scatter available or "create" create the scatterplot
	 * @param options - Options for the creation of the scatterplot
	 */
	private createUpdateScatterplot(opKind: "update" | "create",
									options: CreateUpdateScatterplotOptions = {}): void {

		const scatterplotOpen = isSecondaryWindowOpen("/fp-scatterplot");
		if(opKind !== "create" && !scatterplotOpen) return;

		// Filter by enabled status on structures
		const enabled = this.accumulator.getEnabledStructures();

		// Take the points projected to 2D
		const points = this.dist.getProjectedPoints(enabled);

		// Check if energy present
		const hasEnergies = this.accumulator.accumulatedHaveEnergies();

		// Collect and prepare the data for the scatterplot
		const scatterplotData = options.plotType === "fidelity" ?
									this.prepareFidelityData(points, enabled, hasEnergies) :
									this.prepareScatterplotData(points, enabled, options, hasEnergies);

		// If the selected points list should be updated
		if(options.selectedPoints && options.selectedPoints.length > 0) {
			scatterplotData.selectedPoints = options.selectedPoints;
		}

		const dataToSend = JSON.stringify(scatterplotData);

		// Create the scatterplot window. If it is open, update it
		createOrUpdateSecondaryWindow({
			routerPath: "/fp-scatterplot",
			width: 1600,
			height: 900,
			title: "Fingerprints scatterplot",
			data: dataToSend,
			alreadyOpen: scatterplotOpen
		});
	}

	/**
	 * Open or update the energy landscape window
	 *
	 * @param opKind - Operation to be performed:
	 *                 "update" update if scatter available or "create" create the landscape
	 */
	private createUpdateLandscape(opKind: "update" | "create"): void {

		const landscapeOpen = isSecondaryWindowOpen("/fp-landscape");
		if(opKind !== "create" && !landscapeOpen) return;

		// Should have energies
		if(!this.accumulator.accumulatedHaveEnergies()) return;

		// Collect energies per structure
		const energies: number[] = [];
		for(const structure of this.accumulator.iterateSelectedEnabledStructures()) {
			energies.push(structure.energy!);
		}

		// Normalize between 0 and 1
		let minEnergy = Number.POSITIVE_INFINITY;
		let maxEnergy = Number.NEGATIVE_INFINITY;
		for(const energy of energies) {
			if(energy < minEnergy) minEnergy = energy;
			if(energy > maxEnergy) maxEnergy = energy;
		}
		const den = 1 / (maxEnergy - minEnergy);
		for(let i=0; i < energies.length; ++i) {
			energies[i] = (energies[i] - minEnergy)*den;
		}

		// Filter by enabled status on structures
		const enabled = this.accumulator.getEnabledStructures();

		// Take the distance matrix and project it in 2D
		const points = this.dist.getProjectedPoints(enabled);

		// Filter points as enabled during grouping
		const filteredPoints: number[][] = [];
		const filteredEnergies: number[] = [];
		let idx = 0;
		for(const structure of this.accumulator.iterateSelectedStructures()) {
			if(structure.enabled) {
				filteredPoints.push(points[idx]);
				filteredEnergies.push(energies[idx]);
			}
			++idx;
		}

		// Send to energy landscape chart
		const energyLandscapeData: EnergyLandscapeData = {
			points: filteredPoints,
			energies: filteredEnergies,
		};
		const dataToSend = JSON.stringify(energyLandscapeData);

		// Create the energy landscape window. If it is open, update it
		createOrUpdateSecondaryWindow({
			routerPath: "/fp-landscape",
			width: 1500,
			height: 900,
			title: "Fingerprints energy landscape",
			data: dataToSend,
			alreadyOpen: landscapeOpen
		});
	}

	/**
	 * Open or update the charts window
	 *
	 * @param opKind - Operation to be performed:
	 *                 "update" update if new data available or "create" create the chart viewer
	 * @param kind - Kind of chart to display that determines the data to send to the charts window
	 * @param lambda - If kind is "fp" or "di" it is the index of the fingerprint
	 * 				   (not the structure index), if "eh" or "dh" it is the number of buckets
	 * 				   for the histograms
	 */
	private createUpdateCharts(opKind: "update" | "create",
							   kind: FingerprintsChartKind,
							   lambda=0): void {

		const chartsOpen = isSecondaryWindowOpen("/fp-charts");
		if(opKind !== "create" && !chartsOpen) return;

		const haveEnergies = this.accumulator.accumulatedHaveEnergies();
		const haveDistances = this.dist.getDistanceMatrix().matrixSize() > 0;
		const chartData: FingerprintsChartData = {
			haveEnergies,
			haveDistances
		};

		const enabled = this.accumulator.getEnabledStructures();

		switch(kind) {

			case "ed":
				if(haveEnergies) {

					// Collect energies
					const energies: number[] = [];
					for(const structure of this.accumulator.iterateSelectedStructures()) {
						const energy = structure.energy ?? 0;
						energies.push(energy);
					}

					chartData.energyDistance = methodEnergyDistance(energies,
															   		enabled,
															   		this.dist.getDistanceMatrix());
				}
				break;

			case "en":
				if(haveEnergies) {

					// Collect energies
					chartData.energy = [];
					for(const {energy, step}
						of this.accumulator.iterateSelectedEnabledStructures()) {

						chartData.energy.push([step, energy ?? 0]);
					}
				}
				break;

			case "fp": {
				let fpCount = 0;
				const ids: number[] = [];
				for(const structure of this.accumulator.iterateSelectedEnabledStructures()) {
					++fpCount;
					ids.push(structure.step);
				}

				chartData.countFingerprints = fpCount;
				chartData.structureIds = ids;
				const fp = this.accumulator.getFingerprint(lambda);
				chartData.fingerprint = [];
				let x = 0;
				for(const value of fp) {
					chartData.fingerprint.push([x, value]);
					x += this.binSize;
				}
				}
				break;

			case "eh":
				if(haveEnergies) {

					// Collect energies
					const energies: number[] = [];
					for(const structure of this.accumulator.iterateSelectedStructures()) {
						const energy = structure.energy ?? 0;
						energies.push(energy);
					}

					chartData.energyHistogram = methodEnergiesHistogram(energies, enabled, lambda);
				}
				break;

			case "dh":

				chartData.distanceHistogram = methodDistancesHistogram(
					this.dist.getDistanceMatrix(),
					enabled,
					lambda
				);
				break;

			case "op":

				chartData.order = methodOrder(this.accumulator, this.binSize);
				break;

			case "di": {

				const ids: number[] = [];
				for(const structure of this.accumulator.iterateSelectedEnabledStructures()) {
					ids.push(structure.step);
				}

				chartData.distances = methodDistances(this.dist.getDistanceMatrix(),
													  ids, enabled, lambda);
				}
				break;
		}
		const dataToSend = JSON.stringify(chartData);

		// Create the charts window. If it is open, update it
		createOrUpdateSecondaryWindow({
			routerPath: "/fp-charts",
			width: 1500,
			height: 900,
			title: "Fingerprints charts",
			data: dataToSend,
			alreadyOpen: chartsOpen
		});
	}

	/**
	 * Update visualizations if the respective secondary window is open
	 *
	 * @param options - Options for scatterplot
	 */
	updateVisualizations(options: CreateUpdateScatterplotOptions): void {

		this.createUpdateScatterplot("update", options);
		this.createUpdateLandscape("update");
		this.createUpdateCharts("update", this.chartType, this.lambda);
	}

	/**
	 * Open or update the compare structures window
	 *
	 * @param opKind - Operation to be performed:
	 *                 "update" update if new data available or "create" create the window
	 * @param selectedPoints - List of selected points from the scatterplot
	 */
	private createUpdateCompare(opKind: "update" | "create", selectedPoints: number[]): void {

		const compareWindowOpen = isSecondaryWindowOpen("/compare");
		if(opKind !== "create" && !compareWindowOpen) return;

		const steps: number[] = [];
		if(selectedPoints.length > 0) {
			let idx = 0;
			for(const structure of this.accumulator.iterateSelectedStructures()) {
				if(selectedPoints.includes(idx)) steps.push(structure.step);
				++idx;
			}
		}
		const dataToSend = JSON.stringify(steps);

		// Create the scatterplot window. If it is open, update it
		createOrUpdateSecondaryWindow({
			routerPath: "/compare",
			width: 1600,
			height: 900,
			title: "Compare selected structures",
			data: dataToSend,
			alreadyOpen: compareWindowOpen
		});
	}

	/**
	 * Convert an accumulated structure to a Structure type for writing to file
	 *
	 * @param structure - One structure from the accumulator
	 * @returns - The structure as a Structure type
	 */
	private static convertAccumulatedStructure(structure: StructureReduced): Structure {

		const {atomsZ, atomsPosition, basis, step} = structure;
		const natoms = atomsZ.length;
		const atoms: Atom[] = [];
		for(let i=0, i3=0; i < natoms; ++i, i3+=3) {

			atoms.push({
				atomZ: atomsZ[i],
				label: getAtomicSymbol(atomsZ[i]),
				chain: "",
				position: [
					atomsPosition[i3],
					atomsPosition[i3+1],
					atomsPosition[i3+2],
				]
			});
		}
		return {

			crystal: {
				basis,
				origin: [0, 0, 0] as PositionType,
				spaceGroup: "",
			},
			atoms,
			bonds: [],
			volume: [],
			extra: {step}
		};
	}

	/**
	 * Select min energy point for each group
	 *
	 * @returns Array of selected points indices
	 */
	private selectMinEnergyPerGroup(): number[] {

		if(this.accumulator.selectedSize() === 0 ||
		   !this.accumulator.accumulatedHaveEnergies()) return [];
		const ngroups = this.grouping.getCountGroups();
		if(ngroups === 0) return [];
		const groups = this.grouping.getGroups();

		const minEnergy = Array<number>(ngroups).fill(Number.POSITIVE_INFINITY);
		const minEnergyIdx = Array<number>(ngroups).fill(0);

		let idx = 0;
		let onScatterplotIdx = 0;
		for(const structure of this.accumulator.iterateSelectedStructures()) {

			if(structure.enabled) {

				const energy = structure.energy!;
				const group = groups[idx];
				if(energy < minEnergy[group]) {
					minEnergy[group] = energy;
					minEnergyIdx[group] = onScatterplotIdx;
				}
				++onScatterplotIdx;
			}
			++idx;
		}

		return minEnergyIdx;
	}

	/**
	 * Compute the 4D convex hull and take the lower half points
	 *
	 * @returns Array of selected points indices
	 */
	private selectByConvexHull(): number[] {

		const countPoints = this.accumulator.selectedSize();
		if(countPoints === 0 ||
		   !this.accumulator.accumulatedHaveEnergies()) return [];

		const energies: number[] = [];
		const enabled: boolean[] = [];
		for(const structure of this.accumulator.iterateSelectedStructures()) {

			const energy = structure.energy!;
			energies.push(energy);
			enabled.push(structure.enabled);
		}
		const points3D = this.dist.getProjectedPoints3D(enabled);
		return generalizedConvexHull4D(points3D, enabled, energies);
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

			fingerprintMethods: this.fingerprintMethodsNames,
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

			removeDuplicates: this.removeDuplicates,
			duplicatesThreshold: this.duplicatesThreshold,
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

			this.addToAccumulator(this.structure);

			const status = this.accumulator.filterOnEnergy(this.enableEnergyFiltering,
														   this.energyThreshold,
														   this.thresholdFromMinimum);
			if(status.error) {
				sendAlertToClient(status.error, {node: "fingerprints"});
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

        this.enableEnergyFiltering = params.enableEnergyFiltering as boolean ?? false;
        this.thresholdFromMinimum = params.thresholdFromMinimum as boolean ?? false;
        this.energyThreshold = params.energyThreshold as number ?? 0;

		const status = this.accumulator.filterOnEnergy(this.enableEnergyFiltering,
														this.energyThreshold,
														this.thresholdFromMinimum);
		if(status.error) {
			sendAlertToClient(status.error, {node: "fingerprints"});
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
	private async channelFP(params: CtrlParams): Promise<CtrlParams> {

		this.fingerprintingMethod = params.fingerprintingMethod as number ?? 0;
        this.binSize = params.binSize as number ?? 0.05;
        this.peakWidth = params.peakWidth as number ?? 0.02;
		this.distanceMethod = params.distanceMethod as number ?? 0;
		this.fixTriangleInequality = params.fixTriangleInequality as boolean ?? false;
        this.removeDuplicates = params.removeDuplicates as boolean ?? true;
        this.duplicatesThreshold = params.duplicatesThreshold as number ?? 0.015;
		this.processParallelism = params.processParallelism as boolean ?? false;

		const resultFP = await this.fp.compute(this.accumulator, {
			method: this.fingerprintingMethod,
			areNanoclusters: this.areNanoclusters,
			cutoffDistance: this.cutoffDistance,
			binSize: this.binSize,
			peakWidth: this.peakWidth,
			processParallelism: this.processParallelism
		});

		if(resultFP.error) {

			if(resultFP.userError) sendAlertToClient(resultFP.error,
													{userMessage: resultFP.userError,
													 node: "fingerprints"});
			else sendAlertToClient(resultFP.error, {node: "fingerprints"});

			return {
				resultDimensionality: 0,
				countDistances: 0,
				endMessage: "",
				embeddedDimension: 0
			};
		}

		const resultDist = this.dist.measureAll(this.accumulator,
			this.distanceMethod,
			this.fixTriangleInequality);

		if(resultDist.error) sendAlertToClient(resultDist.error, {node: "fingerprints"});

		// Remove duplicates
		const pointsRemoved = removeDuplicatePoints(this.removeDuplicates,
													this.accumulator,
													this.dist,
													this.duplicatesThreshold);

		// Compute the intrinsic dimension of the fingerprints space
		const estimatorResult = embeddedDimensionEstimator(this.accumulator);

		// Update the scatterplot if it is open
		this.updateVisualizations({noGroups: true, plotType: this.plotType});

		return {
			resultDimensionality: resultFP.dimension,
			countDistances: resultDist.countDistances,
			endMessage: resultDist.endMessage,
			pointsRemoved,
			intrinsicDimension: estimatorResult.avg,
			minLocalDimension: estimatorResult.min,
			maxLocalDimension: estimatorResult.max,
			theoreticalDimension: estimatorResult.theory
		};
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
        this.removeDuplicates = params.removeDuplicates as boolean ?? true;
        this.duplicatesThreshold = params.duplicatesThreshold as number ?? 0.015;

		const result = this.dist.measureAll(this.accumulator,
											this.distanceMethod,
											this.fixTriangleInequality);

		if(result.error) sendAlertToClient(result.error, {node: "fingerprints"});

		// Remove duplicates
		const pointsRemoved = removeDuplicatePoints(this.removeDuplicates,
													this.accumulator,
													this.dist,
													this.duplicatesThreshold);

		// Update the scatterplot if it is open
		this.updateVisualizations({noGroups: true, plotType: this.plotType});

		return {
			countDistances: result.countDistances,
			endMessage: result.endMessage,
			pointsRemoved
		};
	}

	/**
	 * Channel handler for remove duplicates parameters change
	 *
	 * @param params - Parameters from the UI
	 */
	private channelDuplicates(params: CtrlParams): CtrlParams {

        this.removeDuplicates = params.removeDuplicates as boolean ?? true;
        this.duplicatesThreshold = params.duplicatesThreshold as number ?? 0.015;
		const pointsRemoved = removeDuplicatePoints(this.removeDuplicates,
													this.accumulator,
													this.dist,
													this.duplicatesThreshold);

		// Update the scatterplot if it is open
		this.updateVisualizations({plotType: this.plotType});

		return {
			pointsRemoved
		};
	}

	/**
	 * Channel handler for grouping parameters change
	 *
	 * @param params - Parameters from the UI
	 */
	private channelGroupParams(params: CtrlParams): void {

		this.groupingMethod = params.groupingMethod as number ?? 0;
        this.groupingThreshold = params.groupingThreshold as number ?? 0.1;
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
        this.groupingThreshold = params.groupingThreshold as number ?? 0.1;
        this.addedMargin = params.addedMargin as number ?? 0;

		const result = this.grouping.group(this.accumulator, this.dist.getDistanceMatrix(),
										   this.groupingMethod, this.groupingThreshold, this.addedMargin);

		if(result.error) sendAlertToClient(result.error, {node: "fingerprints"});

		// Update the scatterplot if it is open
		this.updateVisualizations({plotType: this.plotType});

		return {countGroups: result.countGroups};
	}

	/**
	 * Channel handler for opening scatterplot on the results
	 */
	private channelScatter(): CtrlParams {

		this.createUpdateScatterplot("create", {plotType: this.plotType});

		// If not already opened, open the channels
		if(ComputeFingerprints.channelOpened) return {status: "opened"};
		ComputeFingerprints.channelOpened = true;

		const writer = new WriterPOSCAR();

		ipcMain.handle("SYSTEM:selected-points",
					   (_event, params: CtrlParams): CtrlParams => {

			const steps = params.selectedSteps as number[];
			if(steps.length === 0) return {error: "No points selected"};
			const filename = params.filename as string;
			if(!filename) return {error: "No filename provided"};
			const saveEnergyPerAtom = params.saveEnergyPerAtom as boolean ?? false;

			const sorter: SorterItem[] = [];
			const structures: Structure[] = [];
			let k = 0;
			const hasEnergies = this.accumulator.accumulatedHaveEnergies();

			for(const step of steps) {
				const structure = this.accumulator.getStructureByStep(step);
				if(!structure) return {error: `Invalid step: ${step}`};
				structures.push(ComputeFingerprints.convertAccumulatedStructure(structure));
				if(hasEnergies) {

					const energy = structure.energy!;
					const outEnergy = saveEnergyPerAtom ? energy : energy * structure.atomsZ.length;
					sorter.push({idx: k++, energy, outEnergy});
				}
			}
			return this.exportStructuresAndEnergy(filename, writer, structures, sorter);
		});

		ipcMain.on("SYSTEM:selected-plot", (_event, params: CtrlParams): void => {

			this.plotType = params.plotType as PlotKind ?? "group";

			this.createUpdateScatterplot("update", {plotType: this.plotType});
		});

		ipcMain.handle("SYSTEM:get-selections", (_event, params: CtrlParams): CtrlParams => {

			const criteria = params.criteria as string ?? "";

			let selectedPoints: number[] = [];
			switch(criteria) {
				case "min-energy":
					selectedPoints = this.selectMinEnergyPerGroup();
					break;
				case "convex-hull":
					selectedPoints = this.selectByConvexHull();
					break;
			}
			return {selectedPoints};
		});

		ipcMain.on("SYSTEM:compare", (_event, params: CtrlParams): void => {

			const selectedPoints = params.selectedPoints as number[] ?? [];
			this.createUpdateCompare("create", selectedPoints);
		});

		ipcMain.on("SYSTEM:updated-selection", (_event, params: CtrlParams): void => {

			const updatedStepsSelection = params.updatedStepsSelection as number[] ?? [];

			const updatedSelectedPoints: number[] = [];
			let idx = 0;
			for(const structure of this.accumulator.iterateSelectedStructures()) {
				if(updatedStepsSelection.includes(structure.step)) {
					updatedSelectedPoints.push(idx);
				}
				++idx;
			}
			this.createUpdateScatterplot("update", {plotType: this.plotType,
													selectedPoints: updatedSelectedPoints
													});
		});

		ipcMain.handle("SYSTEM:get-structure", (_event, params: CtrlParams): CtrlParams => {

			const empty: CtrlParams = {};
			const step = params.step as number;
			if(step === undefined) return empty;
			const structure = this.accumulator.getStructureByStep(step);
			if(!structure) return empty;

			const out: CtrlParams = {
				basis: structure.basis as number[],
				positions: structure.atomsPosition,
				radii: [],
				bonds: []
			};

			for(const atomZ of structure.atomsZ) {
				(out.radii as number[]).push(getAtomData(atomZ).rCov/2);
			}
			out.bonds = [...structure.bonds];

			return out;
		});

		return {status: "done"};
	}

	/**
	 * Channel handler for opening energy surface display
	 */
	private channelLandscape(): void {

		this.createUpdateLandscape("create");
	}

	/**
	 * Channel handler for opening fingerprints charts
	 */
	private channelCharts(): void {

		this.createUpdateCharts("create", "fp");

		if(!this.channelChartsOpened) {
			this.channelChartsOpened = true;

			ipcMain.on("SYSTEM:chart-request", (_event: unknown, params: CtrlParams): void => {

				this.chartType = params.chartType as FingerprintsChartKind ?? "fp";
				this.lambda = 0;
				switch(this.chartType) {
					case "fp":
					case "di":
						this.lambda = params.fpIndex as number ?? 0;
						break;
					case "eh":
					case "dh":
						this.lambda = params.binCount as number ?? 50;
						break;
					case "en":
					case "ed":
					case "op":
						this.lambda = 0;
						break;
				}

				this.createUpdateCharts("update", this.chartType, this.lambda);
			});
		}
	}

	/**
	 * Channel handler for fingerprint structure export
	 */
	private channelExport(): void {

		const hasEnergy = this.accumulator.accumulatedHaveEnergies();

		const dataToSend = JSON.stringify({hasEnergy});

		// Create the export window. If it is open, update it
		createOrUpdateSecondaryWindow({
			routerPath: "/fp-export",
			width: 370,
			height: 500,
			title: "Export fingerprint results",
			data: dataToSend
		});

		if(!this.channelExportOpened) {
			this.channelExportOpened = true;

			const writer = new WriterPOSCAR();

			ipcMain.handle("SYSTEM:export-points", (_event: unknown, params: CtrlParams): CtrlParams => {

				const kind = params.kind as string;
				const filename = params.filename as string;
				const saveEnergyPerAtom = params.saveEnergyPerAtom as boolean ?? false;

				const structures: Structure[] = [];
				const sorter: SorterItem[] = [];

				switch(kind) {
					case "all":
						this.getAllEnabledStructures(saveEnergyPerAtom, structures, sorter);
						break;
					case "min":
						this.getMinEnergyPerGroup(saveEnergyPerAtom, structures, sorter);
						break;
					default:
						return {error: "Invalid kind"};
				}

				return this.exportStructuresAndEnergy(filename, writer, structures, sorter);
			});
		}
	}

	/**
	 * Export all enabled structures
	 *
	 * @param saveEnergyPerAtom - True if the energy saved should be per atom
	 * @param structures - Resulting structures to be exported
	 * @param sorter - Auxiliary list of energies for output sorting
	 */
	private getAllEnabledStructures(saveEnergyPerAtom: boolean,
									structures: Structure[],
									sorter: SorterItem[]): void {

		structures.length = 0;
		sorter.length = 0;
		let k = 0;

		const haveEnergies = this.accumulator.accumulatedHaveEnergies();
		for(const structure of this.accumulator.iterateSelectedEnabledStructures()) {
			structures.push(ComputeFingerprints.convertAccumulatedStructure(structure));
			if(haveEnergies) {

				const energy = structure.energy!;
				const outEnergy = saveEnergyPerAtom ? energy : energy * structure.atomsZ.length;
				sorter.push({idx: k++, energy, outEnergy});
			}
		}
	}

	/**
	 * Export all enabled structures
	 *
	 * @param saveEnergyPerAtom - True if the energy saved should be per atom
	 * @param structures - Resulting structures to be exported
	 * @param sorter - Auxiliary list of energies for output sorting
	 */
	private getMinEnergyPerGroup(saveEnergyPerAtom: boolean,
								 structures: Structure[],
								 sorter: SorterItem[]): void {

		structures.length = 0;
		sorter.length = 0;

		if(!this.accumulator.accumulatedHaveEnergies()) return;
		const ngroups = this.grouping.getCountGroups();
		if(ngroups === 0) return;
		const groups = this.grouping.getGroups();

		const minEnergy = Array<number>(ngroups).fill(Number.POSITIVE_INFINITY);
		const minEnergyStep = Array<number>(ngroups).fill(0);

		let idx = 0;
		for(const structure of this.accumulator.iterateSelectedStructures()) {

			if(structure.enabled) {

				const energy = structure.energy!;
				const group = groups[idx];
				if(energy < minEnergy[group]) {
					minEnergy[group] = energy;
					minEnergyStep[group] = structure.step;
				}
			}
			++idx;
		}

		for(let k=0; k < ngroups; ++k) {

			const step = minEnergyStep[k];
			const structure = this.accumulator.getStructureByStep(step);
			if(!structure) continue;
			const energy = minEnergy[k];
			const outEnergy = saveEnergyPerAtom ? energy : energy * structure.atomsZ.length;
			sorter.push({idx: k, energy, outEnergy});
			structures.push(ComputeFingerprints.convertAccumulatedStructure(structure));
		}
	}

	/**
	 * Export structures and energies
	 *
	 * @param filename - Structure file name. The energy file is derived from it
	 * @param writer - The structure writer to use (POSCAR format)
	 * @param structures - Resulting structures to be exported
	 * @param sorter - Auxiliary list of energies for output sorting
	 * @returns File names or error message
	 */
	private exportStructuresAndEnergy(filename: string,
									  writer: WriterPOSCAR,
									  structures: Structure[],
									  sorter: SorterItem[]): CtrlParams {

		if(structures.length === 0) return {error: "No structures to save"};

		const sortedStructures: Structure[] = [];
		let energies = "";
		const hasEnergies = sorter.length > 0;
		if(hasEnergies) {

			sorter.sort((a, b) => a.energy - b.energy);

			for(const entry of sorter) {
				sortedStructures.push(structures[entry.idx]);
				energies += `${entry.outEnergy.toFixed(4)}\n`;
			}
		}
		const sts = writer.writeStructure(filename,
										  hasEnergies ? sortedStructures :
										  				structures);

		if(sts.error) return {error: `Error writing structures file: ${sts.error as string}`};
		const returnStatus = {structurePath: filename, energyPath: ""};

		if(hasEnergies) {

			const pos = filename.lastIndexOf(".");
			const energyFilename = pos > 0 ?
										`${filename.slice(0, pos)}.energy` :
										`${filename}.energy`;
			try {
				writeFileSync(energyFilename, energies, "utf8");
			}
			catch(error: unknown) {
				return {error: `Error writing energy file: ${(error as Error).message}`};
			}
			returnStatus.energyPath = energyFilename;
		}

		return returnStatus;
	}
}
