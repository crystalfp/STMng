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
import {createSecondaryWindow, isSecondaryWindowOpen,
		sendToSecondaryWindow} from "../modules/WindowsUtilities";
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
			 ScatterplotData} from "@/types";

/**
 * Options for the scatterplot creation
 * @notExported
 */
interface CreateUpdateScatterplotOptions {

	/** Kind of plot for which the data should be provided */
	plotType?: string;

	/** True if the group are not provided */
	noGroups?: boolean;

	/** Updated list of selected points */
	selectedPoints?: number[];
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

	private distanceMethod = 0;
	private fixTriangleInequality = false;

	private groupingMethod = 0;
	private groupingThreshold = 0.1;
	private addedMargin = 0;

	private removeDuplicates = true;
	private duplicatesThreshold = 0.015;

	private plotType = "group";

	private chartType: FingerprintsChartKind = "fp";
	private lambda = 0;

	private static channelOpened = false;
	private channelChartsOpened = false;

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
		{name: "scatter",		type: "send",	callback: this.channelScatter.bind(this)},
		{name: "landscape",		type: "send",	callback: this.channelLandscape.bind(this)},
		{name: "charts",		type: "send",	callback: this.channelCharts.bind(this)},
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
		this.addedMargin = params.addedMargin as number ?? 0;
        this.removeDuplicates = params.removeDuplicates as boolean ?? true;
        this.duplicatesThreshold = params.duplicatesThreshold as number ?? 0.015;
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
			default:
				throw Error("Invalid plot type");
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

		// Take the points projected to 2D
		const points = this.dist.getProjectedPoints();

		// Filter by enabled status on structures and check if energy present
		const hasEnergies = this.accumulator.accumulatedHaveEnergies();
		const enabled = this.accumulator.getEnabledStructures();

		// Collect and prepare the data for the scatterplot
		const scatterplotData = options.plotType === "fidelity" ?
									this.prepareFidelityData(points, enabled, hasEnergies) :
									this.prepareScatterplotData(points, enabled, options, hasEnergies);

		// If the selected points list should be updated
		if(options.selectedPoints && options.selectedPoints.length > 0) {
			scatterplotData.selectedPoints = options.selectedPoints;
		}

		const dataToSend = JSON.stringify(scatterplotData);

		// If it is open, update the scatterplot window
		if(scatterplotOpen) {

			sendToSecondaryWindow("/fp-scatterplot", dataToSend);
		}
		else {

			// Create the scatterplot window
			createSecondaryWindow({
				routerPath: "/fp-scatterplot",
				width: 1600,
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
		for(let i=0; i < energies.length; ++i) {
			energies[i] = (energies[i] - minEnergy) / (maxEnergy - minEnergy);
		}

		// Take the distance matrix and project it in 2D
		const points = this.dist.getProjectedPoints();

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

		// If it is open, update the energy landscape window
		if(landscapeOpen) {

			sendToSecondaryWindow("/fp-landscape", dataToSend);
		}
		else {

			// Create the energy landscape window
			createSecondaryWindow({
				routerPath: "/fp-landscape",
				width: 1500,
				height: 900,
				title: "Fingerprints energy landscape",
				data: dataToSend
			});
		}
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
					for(const structure of this.accumulator.iterateSelectedEnabledStructures()) {

						const {energy, step} = structure;

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

		// If it is open, update the charts window
		if(chartsOpen) {

			sendToSecondaryWindow("/fp-charts", dataToSend);
		}
		else {

			// Create the charts window
			createSecondaryWindow({
				routerPath: "/fp-charts",
				width: 1500,
				height: 900,
				title: "Fingerprints charts",
				data: dataToSend
			});
		}
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

		// If it is open, update the compare window
		if(compareWindowOpen) {

			sendToSecondaryWindow("/compare", dataToSend);
		}
		else {

			// Create the scatterplot window
			createSecondaryWindow({
				routerPath: "/compare",
				width: 1600,
				height: 900,
				title: "Compare selected structures",
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
	private static convertAccumulatedStructure(structure: StructureReduced): Structure {

		const {atomsZ, atomsPosition, basis, step} = structure;
		const natoms = atomsZ.length;
		const atoms: Atom[] = [];
		for(let i=0; i < natoms; ++i) {

			atoms.push({
				atomZ: atomsZ[i],
				label: getAtomicSymbol(atomsZ[i]),
				chain: "",
				position: [
					atomsPosition[3*i],
					atomsPosition[3*i+1],
					atomsPosition[3*i+2],
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

		return generalizedConvexHull4D(this.dist.getDistanceMatrix(),
									   countPoints,
									   enabled,
									   energies);
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

		const resultFP = await this.fp.compute(this.accumulator, {
			method: this.fingerprintingMethod,
			areNanoclusters: this.areNanoclusters,
			cutoffDistance: this.cutoffDistance,
			binSize: this.binSize,
			peakWidth: this.peakWidth
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

		// Project points to 2D
		this.dist.projectPoints();

		// Remove duplicates
		const pointsRemoved = removeDuplicatePoints(this.removeDuplicates,
													this.accumulator,
													this.dist,
													this.duplicatesThreshold);

		// Update the scatterplot if it is open
		this.updateVisualizations({noGroups: true, plotType: this.plotType});

		// Compute the intrinsic dimension of the fingerprints space
		const estimatorResult = embeddedDimensionEstimator(this.accumulator);

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

		// Project points to 2D
		this.dist.projectPoints();

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
	private channelScatter(): void {

		this.createUpdateScatterplot("create", {plotType: this.plotType});

		// If not already opened, open the channels
		if(ComputeFingerprints.channelOpened) return;
		ComputeFingerprints.channelOpened = true;

		ipcMain.handle("SYSTEM:selected-points",
					   async (_event, params: CtrlParams): Promise<CtrlParams> => {

			const points = params.points as string;
			if(!points)	return {error: "No points selected"};
			const indices = params.points as number[];
			if(indices.length === 0) return {error: "No points selected"};
			const filename = params.filename as string;
			if(!filename) return {error: "No filename provided"};

			const sorter: {idx: number; energy: number}[] = [];
			let structures: Structure[] = [];
			let idx = 0;
			let k = 0;
			const hasEnergies = this.accumulator.accumulatedHaveEnergies();

			for(const structure of this.accumulator.iterateSelectedStructures()) {
				if(indices.includes(idx)) {
					structures.push(ComputeFingerprints.convertAccumulatedStructure(structure));
					if(hasEnergies) {
						sorter.push({idx: k++, energy: structure.energy!*structure.atomsZ.length});
					}
				}
				++idx;
			}

			if(structures.length === 0) return {error: "No structures to save"};

			const sortedStructures: Structure[] = [];
			const energies: string[] = [];
			if(sorter.length > 0) {
				sorter.sort((a, b) => a.energy - b.energy);

				for(const entry of sorter) {
					sortedStructures.push(structures[entry.idx]);
					energies.push(entry.energy.toFixed(4));
				}
				structures = sortedStructures;
			}
			const {WriterPOSCAR} = await import("../writers/WritePOSCAR");
			const writer = new WriterPOSCAR();
			const sts = writer.writeStructure(filename, structures);

			if(sts.error) return {error: sts.error};
			const returnStatus = {structurePath: filename, energyPath: ""};

			if(energies.length > 0) {
				const pos = filename.lastIndexOf(".");
				const energyFilename = pos > 0 ?
											`${filename.slice(0, pos)}.energy` :
											`${filename}.energy`;
				try {
					writeFileSync(energyFilename, energies.join("\n"), "utf8");
				}
				catch(error: unknown) {
					return {error: `Error writing energy file: ${(error as Error).message}`};
				}
				returnStatus.energyPath = energyFilename;
			}

			return returnStatus;
		});

		ipcMain.on("SYSTEM:selected-plot", (_event, params: CtrlParams): void => {

			this.plotType = params.plotType as string ?? "group";

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
				positions: structure.atomsPosition as number[],
				radii: [],
				bonds: []
			};

			for(const atomZ of structure.atomsZ) {
				(out.radii as number[]).push(getAtomData(atomZ).rCov/2);
			}
			out.bonds = [...structure.bonds];

			return out;
		});
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
				}

				this.createUpdateCharts("update", this.chartType, this.lambda);
			});
		}
	}
}
