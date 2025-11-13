/**
 * Slice structure along a plane, a sphere or a slab
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-04-09
 */
import {hasNoUnitCell} from "../modules/Helpers";
import {NodeCore} from "../modules/NodeCore";
import {selectAtomsByKind, type SelectorType} from "../modules/AtomsChooser";
import {EmptyStructure} from "../modules/EmptyStructure";
import {findIntersections} from "../modules/UnitCellIntersections";
import type {Structure, ChannelDefinition, CtrlParams,
			 BasisType, PositionType, SlicingModes} from "@/types";

/**
 * Slice plane parameters
 * @notExported
 */
interface PlaneParams {
	/** Normalized normal to the plane */
	normal: number[];
	/** A point on the plane */
	point: number[];
}

export class SliceStructure extends NodeCore {

	private structure: Structure | undefined;
	private enableSlicer = false;
	private showSlicer = false;
	private sliceInside = false;
	private mode: SlicingModes = "plane";

	private selectorKind: SelectorType = "symbol";
	private atomsSelector = "";
	private sphereRadius = 1; // Sphere radius

	private parallelA = false;
	private percentA = 50;
	private parallelB = false;
	private percentB = 50;
	private parallelC = false;
	private percentC = 50;
	private thickness = 1; // Slab thickness

	private millerH = 1; // Miller indices
	private millerK = 0;
	private millerL = 0;
	private millerPlaneOffset = 0;

	private readonly sphereRenderingParams: number[] = [];
	private planeRenderingIntersections: number[] = [];
	private planeRenderingIntersections2: number[] = [];

	private planesNormals: number[] = [];
	private planesPoints: number[] = [];

	private readonly channels: ChannelDefinition[] = [
		{name: "init",      type: "invoke", callback: this.channelInit.bind(this)},
		{name: "sphere",	type: "invoke",	callback: this.channelSphere.bind(this)},
		{name: "plane",		type: "invoke",	callback: this.channelPlane.bind(this)},
		{name: "miller",	type: "invoke",	callback: this.channelMiller.bind(this)},
		{name: "slab",		type: "invoke",	callback: this.channelSlab.bind(this)},
		{name: "direct",	type: "send",	callback: this.channelDirect.bind(this)},
		{name: "set",		type: "send", 	callback: this.channelSet.bind(this)},
		{name: "bonded",	type: "send",	callback: this.channelBonded.bind(this)},
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

	override fromPreviousNode(data: Structure): void {

		if(!data?.atoms.length) {
			this.toNextNode(new EmptyStructure());
			return;
		}

		this.structure = data;

		if(this.enableSlicer || this.showSlicer) this.prepareSlicerGeometry();
		this.toNextNode(this.enableSlicer ? this.sliceStructure() : this.structure);
	}

	// > Load/save status
	/**
	 * Pack node status
	 *
	 * @returns Status of the node
	 */
	private packFullStatus(): CtrlParams {

		return {
			enableSlicer: this.enableSlicer,
			showSlicer: this.showSlicer,
			sliceInside: this.sliceInside,
			mode: this.mode,
			parallelA: this.parallelA,
			percentA: this.percentA,
			parallelB: this.parallelB,
			percentB: this.percentB,
			parallelC: this.parallelC,
			percentC: this.percentC,
			millerH: this.millerH,
			millerK: this.millerK,
			millerL: this.millerL,
			millerPlaneOffset: this.millerPlaneOffset,
			selectorKind: this.selectorKind,
			atomsSelector: this.atomsSelector,
			sphereRadius: this.sphereRadius,
			thickness: this.thickness,
		};
	}

	saveStatus(): string {
        const statusToSave = this.packFullStatus();
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

		this.enableSlicer = params.enableSlicer as boolean ?? false;
		this.showSlicer = params.showSlicer as boolean ?? false;
		this.sliceInside = params.sliceInside as boolean ?? false;
		this.mode = params.mode as SlicingModes ?? "plane";
        this.parallelA = params.parallelA as boolean ?? false;
        this.percentA = params.percentA as number ?? 50;
        this.parallelB = params.parallelB as boolean ?? false;
        this.percentB = params.percentB as number ?? 50;
        this.parallelC = params.parallelC as boolean ?? false;
        this.percentC = params.percentC as number ?? 50;
        this.millerH = params.millerH as number ?? 1;
        this.millerK = params.millerK as number ?? 0;
        this.millerL = params.millerL as number ?? 0;
		this.millerPlaneOffset = params.millerPlaneOffset as number ?? 0;
        this.selectorKind = params.selectorKind as SelectorType ?? "symbol";
		this.atomsSelector = params.atomsSelector as string ?? "";
        this.sphereRadius = params.sphereRadius as number ?? 1;
        this.thickness = params.thickness as number ?? 1;
	}

	/**
	 * Compute the slicer parameters and the slicer geometry parameters
	 */
	private prepareSlicerGeometry(): void {

		if(this.mode === "direct" || this.mode === "bonded") return;

		if(this.mode === "sphere") {
			this.prepareSphereSlicerGeometry();
			return;
		}
		if(!this.structure || hasNoUnitCell(this.structure.crystal.basis)) {
			return;
		}
		switch(this.mode) {
			case "plane":  {this.preparePlaneSlicerGeometry(); return;}
			case "miller": {this.prepareMillerSlicerGeometry(); return;}
			case "slab":   {this.prepareSlabSlicerGeometry(); return;}
		}
	}

	/**
	 * Prepare the sphere geometries
	 */
	private prepareSphereSlicerGeometry(): void {

		const centerAtomsIdx = selectAtomsByKind(this.structure!,
												 this.selectorKind,
												 this.atomsSelector);

		this.sphereRenderingParams.length = 0;
		for(const idx of centerAtomsIdx) {

			const center = this.structure!.atoms[idx].position;
			this.sphereRenderingParams.push(center[0], center[1], center[2]);
		}
	}

	/**
	 * Unify the plane creation in the simple case
	 *
	 * @param basis - Structure basis
	 * @param origin - Structure origin
	 * @returns Normal and a point to define the plane
	 */
	private createSimplePlane(basis: BasisType, origin: PositionType): PlaneParams {

		const pa = this.percentA/100;
		const pb = this.percentB/100;
		const pc = this.percentC/100;

		const points = [
			pa*basis[0]+origin[0],
			pa*basis[1]+origin[1],
			pa*basis[2]+origin[2],
			pb*basis[3]+origin[0],
			pb*basis[4]+origin[1],
			pb*basis[5]+origin[2],
			pc*basis[6]+origin[0],
			pc*basis[7]+origin[1],
			pc*basis[8]+origin[2]
		];

		const parallelCode = (this.parallelA ? 1 : 0) +
							 (this.parallelB ? 2 : 0) +
							 (this.parallelC ? 4 : 0);

		return this.createPlane(points, parallelCode, basis);
	}

	/**
	 * Prepare the plane intersections with the unit cell and the plane parameters
	 */
	private preparePlaneSlicerGeometry(): void {

		const {crystal} = this.structure!;
		const {basis, origin} = crystal;

		const {normal, point} = this.createSimplePlane(basis, origin);

		this.planesNormals = [
			normal[0],
			normal[1],
			normal[2]
		];
		this.planesPoints = [
			point[0],
			point[1],
			point[2]
		];

		this.planeRenderingIntersections = findIntersections(basis, origin, normal, point).flat();
	}

	/**
	 * Prepare a plane identified by its (hkl) Miller indices
	 */
	private prepareMillerSlicerGeometry(): void {

		const {crystal} = this.structure!;
		const {basis, origin} = crystal;
		let parallelCode = 0;
		const points = Array<number>(9).fill(0);

		if(this.millerH === 0) {
			parallelCode += 1;
		}
		else {
			const h = 1/this.millerH;
			const pa = h < 0 ? 1+h : h;
			points[0] = pa*basis[0]+origin[0];
			points[1] = pa*basis[1]+origin[1];
			points[2] = pa*basis[2]+origin[2];
		}

		if(this.millerK === 0) {
			parallelCode += 2;
		}
		else {
			const k = 1/this.millerK;
			const pb = k < 0 ? 1+k : k;
			points[3] = pb*basis[3]+origin[0];
			points[4] = pb*basis[4]+origin[1];
			points[5] = pb*basis[5]+origin[2];
		}

		if(this.millerL === 0) {
			parallelCode += 4;
		}
		else {
			const l = 1/this.millerL;
			const pc = l < 0 ? 1+l : l;
			points[6] = pc*basis[6]+origin[0];
			points[7] = pc*basis[7]+origin[1];
			points[8] = pc*basis[8]+origin[2];
		}

		const {normal, point} = this.createPlane(points, parallelCode, basis);

		this.planesNormals = [
			normal[0],
			normal[1],
			normal[2]
		];

		if(this.millerPlaneOffset !== 0) {
			point[0] += this.millerPlaneOffset*normal[0];
			point[1] += this.millerPlaneOffset*normal[1];
			point[2] += this.millerPlaneOffset*normal[2];
		}

		this.planesPoints = [
			point[0],
			point[1],
			point[2]
		];

		this.planeRenderingIntersections = findIntersections(basis, origin, normal, point).flat();
	}

	/**
	 * Prepare the slab planes
	 */
	private prepareSlabSlicerGeometry(): void {

		const {crystal} = this.structure!;
		const {basis, origin} = crystal;

		const {normal, point} = this.createSimplePlane(basis, origin);

		this.planesNormals = [
			normal[0],
			normal[1],
			normal[2]
		];

		const halfThickness = this.thickness/2;
		const offsetAlongNormal = [
			halfThickness*normal[0],
			halfThickness*normal[1],
			halfThickness*normal[2]
		];

		const pt1 = [
			point[0]+offsetAlongNormal[0],
			point[1]+offsetAlongNormal[1],
			point[2]+offsetAlongNormal[2]
		];
		const pt2 = [
			point[0]-offsetAlongNormal[0],
			point[1]-offsetAlongNormal[1],
			point[2]-offsetAlongNormal[2]
		];

		this.planesPoints = [
			pt1[0],
			pt1[1],
			pt1[2],
			pt2[0],
			pt2[1],
			pt2[2]
		];

		this.planeRenderingIntersections  = findIntersections(basis, origin, normal, pt1).flat();
		this.planeRenderingIntersections2 = findIntersections(basis, origin, normal, pt2).flat();
	}

	/**
	 * Slice structure according to the mode
	 *
	 * @returns Sliced structure
	 */
	private sliceStructure(): Structure {

		if(!this.structure) return new EmptyStructure();

		// eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
		switch(this.mode) {
			case "sphere": return this.sliceSphere();
			case "bonded": return this.sliceBonded();
			case "direct": return this.sliceDirect();
		}

		if(hasNoUnitCell(this.structure.crystal.basis)) {
			return this.structure;
		}

		switch(this.mode) {
			case "plane":  return this.slicePlane();
			case "miller": return this.slicePlane();
			case "slab":   return this.sliceSlab();
		}
	}

	/**
	 * Select atoms for output
	 *
	 * @param select - Which atoms should be copied to output
	 * @returns A new structure containing the selected atoms
	 */
	private selectAtoms(select: boolean[]): Structure {

		// Reverse the side of the slice
		if(this.sliceInside) {
			for(let idx=0; idx < select.length; ++idx) {
				select[idx] = !select[idx];
			}
		}

		const {atoms, bonds, volume, extra, crystal} = this.structure!;
		const {basis, origin, spaceGroup} = crystal;
		const mapAtomIdx = new Map<number, number>();

		const outStructure: Structure = {
			crystal: {
				basis,
				origin,
				spaceGroup
			},
			atoms: [],
			bonds: [],
			volume,
			extra
		};

		let mappedIdx = 0;
		for(let idx=0; idx < select.length; ++idx) {
			if(select[idx]) {
				outStructure.atoms.push(atoms[idx]);
				mapAtomIdx.set(idx, mappedIdx++);
			}
		}
		for(const bond of bonds) {
			if(select[bond.from] && select[bond.to]) {
				outStructure.bonds.push({
					from: mapAtomIdx.get(bond.from)!,
					to: mapAtomIdx.get(bond.to)!,
					type: bond.type
				});
			}
		}

		return outStructure;
	}

	/**
	 * Slice structure according to a sphere
	 *
	 * @param centerAtomsIdx - Indices of center atoms
	 * @returns Structure with atoms sliced by the sphere
	 */
	private sliceSphere(): Structure {

		if(!this.structure) return new EmptyStructure();

		const natoms = this.structure.atoms.length;
		const inside = Array<boolean>(natoms).fill(false);

		for(let k=0; k < this.sphereRenderingParams.length; k+=3) {

			for(let i=0; i < natoms; ++i) {

				const {position} = this.structure.atoms[i];
				const distance = Math.hypot(position[0]-this.sphereRenderingParams[k+0],
										    position[1]-this.sphereRenderingParams[k+1],
										    position[2]-this.sphereRenderingParams[k+2]);

				if(distance <= this.sphereRadius) inside[i] = true;
			}
		}

		return this.selectAtoms(inside);
	}

	/**
	 * Compute cross product and normalize the result
	 * A x B = (AyBz − AzBy, AzBx − AxBz, AxBy − AyBx)
	 *
	 * @param a - First vector
	 * @param aStart - Index in which start the coordinates in the first vector
	 * @param b - Second vector
	 * @param bStart - Index in which start the coordinates in the second vector
	 * @returns Normalized vector resulting from cross product of the two vectors
	 */
	private crossProductAndNormalize(a: number[], aStart: number,
									 b: number[], bStart: number): number[] {

		const cross = [
			a[aStart+1]*b[bStart+2] - a[aStart+2]*b[bStart+1],
			a[aStart+2]*b[bStart+0] - a[aStart+0]*b[bStart+2],
			a[aStart+0]*b[bStart+1] - a[aStart+1]*b[bStart+0]
		];
		const len = Math.hypot(cross[0], cross[1], cross[2]);
		return [cross[0]/len, cross[1]/len, cross[2]/len];
	}

	/**
	 * Find the middle point between two or three points
	 *
	 * @param points - Array of points coordinates
	 * @param aStart - Index in which start the coordinates of the first point
	 * @param bStart - Index in which start the coordinates of the second point
	 * @param cStart - Index in which start the coordinates of the (optional) third point
	 * @returns Middle point coordinates
	 */
	private middlePoint(points: number[],
						aStart: number,
						bStart: number,
						cStart?: number): number[] {

		if(cStart !== undefined) {
			return [
				(points[aStart]+points[bStart]+points[cStart])/3,
				(points[aStart+1]+points[bStart+1]+points[cStart+1])/3,
				(points[aStart+2]+points[bStart+2]+points[cStart+2])/3
			];
		}
		return [
			(points[aStart]+points[bStart])/2,
			(points[aStart+1]+points[bStart+1])/2,
			(points[aStart+2]+points[bStart+2])/2
		];
	}

	/**
	 * Create the plane
	 *
	 * @param points - The points A, B, C through which the plane must pass
	 * @param parallelCode - Code that identifies to which axis the plane is parallel:
	 * 						 parallelA * 1 + parallelB * 2 + parallelC * 4
	 * @param basis - The structure basis vectors
	 * @returns The normal of the plane and a point on the plane
	 */
	private createPlane(points: number[], parallelCode: number, basis: BasisType): PlaneParams {

		switch(parallelCode) {
			case 0: { // Plane through the 3 points
				const vAB = [points[0]-points[3], points[1]-points[4], points[2]-points[5]]; // AB
				const vAC = [points[0]-points[6], points[1]-points[7], points[2]-points[8]]; // AC
				return {
					normal: this.crossProductAndNormalize(vAB, 0, vAC, 0),
					point: this.middlePoint(points, 0, 3, 6)
				};
			}
			case 1: { // Through b and c parallel to a
				const vBC = [points[3]-points[6], points[4]-points[7], points[5]-points[8]]; // BC
				return {
					normal: this.crossProductAndNormalize(vBC, 0, basis, 0),
					point: this.middlePoint(points, 3, 6)
				};
			}
			case 2: { // Through a and c parallel to b
				const vAC = [points[0]-points[6], points[1]-points[7], points[2]-points[8]]; // AC
				return {
					normal: this.crossProductAndNormalize(vAC, 0, basis, 3),
					point: this.middlePoint(points, 0, 6)
				};
			}
			case 3: // Parallel to a and b through c
				return {
					normal: this.crossProductAndNormalize(basis, 0, basis, 3),
					point: [points[6], points[7], points[8]]
				};
			case 4: { // Through a and b parallel to c
				const vAB = [points[0]-points[3], points[1]-points[4], points[2]-points[5]]; // AB
				return {
					normal: this.crossProductAndNormalize(vAB, 0, basis, 6),
					point: this.middlePoint(points, 0, 3)
				};
			}
			case 5: // Parallel to a and c through b
				return {
					normal: this.crossProductAndNormalize(basis, 0, basis, 6),
					point: [points[3], points[4], points[5]]
				};
			case 6: // Parallel to b and c through a
				return {
					normal: this.crossProductAndNormalize(basis, 3, basis, 6),
					point: [points[0], points[1], points[2]]
				};
		}
		return {normal: [], point: []};
	}

	/**
	 * Slice structure according to a plane
	 *
	 * @returns Sliced structure
	 */
	private slicePlane(): Structure {

		if(!this.structure) return new EmptyStructure();

		const {atoms} = this.structure;
		const natoms = atoms.length;

		const inside = Array<boolean>(natoms).fill(false);

		for(let i=0; i < natoms; ++i) {
			const {position} = atoms[i];
			const dot = this.planesNormals[0]*(position[0]-this.planesPoints[0]) +
						this.planesNormals[1]*(position[1]-this.planesPoints[1]) +
						this.planesNormals[2]*(position[2]-this.planesPoints[2]);
			if(dot >= 0) inside[i] = true;
		}

		return this.selectAtoms(inside);
	}

	/**
	 * Slice the structure inside or outside two parallel planes
	 *
	 * @returns The sliced structure
	 */
	private sliceSlab(): Structure {

		if(!this.structure) return new EmptyStructure();

		const {atoms} = this.structure;
		const natoms = atoms.length;

		const inside = Array<boolean>(natoms).fill(false);
		for(let i=0; i < natoms; ++i) {
			const {position} = atoms[i];
			const dot1 = this.planesNormals[0]*(position[0]-this.planesPoints[0]) +
						 this.planesNormals[1]*(position[1]-this.planesPoints[1]) +
						 this.planesNormals[2]*(position[2]-this.planesPoints[2]);
			const dot2 = this.planesNormals[0]*(position[0]-this.planesPoints[3]) +
						 this.planesNormals[1]*(position[1]-this.planesPoints[4]) +
						 this.planesNormals[2]*(position[2]-this.planesPoints[5]);
			if(dot1 <= 0 && dot2 >= 0) inside[i] = true;
		}

		return this.selectAtoms(inside);
	}

	/**
	 * Slice the structure to the given atoms
	 *
	 * @returns The sliced structure
	 */
	private sliceDirect(): Structure {

		const selectedAtoms = selectAtomsByKind(this.structure!,
												this.selectorKind,
												this.atomsSelector);

		const inside = Array<boolean>(this.structure!.atoms.length).fill(false);
		for(const idx of selectedAtoms) inside[idx] = true;

		return this.selectAtoms(inside);
	}

	/**
	 * Slice the structure to the given atoms and atoms bonded to them
	 *
	 * @returns The sliced structure
	 */
	private sliceBonded(): Structure {

		const selectedAtoms = selectAtomsByKind(this.structure!,
												this.selectorKind,
												this.atomsSelector);

		const inside = Array<boolean>(this.structure!.atoms.length).fill(false);
		for(const idx of selectedAtoms) {

			inside[idx] = true;
			for(const bond of this.structure!.bonds) {
				if(bond.from === idx) inside[bond.to] = true;
				else if(bond.to === idx) inside[bond.from] = true;
			}
		}

		return this.selectAtoms(inside);
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return this.packFullStatus();
	}

	/**
	 * Channel handler for the change of sphere params
	 *
	 * @param params - Parameters from the client
	 */
	private channelSphere(params: CtrlParams): CtrlParams {

		this.selectorKind = params.selectorKind as SelectorType ?? "symbol";
		this.atomsSelector = params.atomsSelector as string ?? "";
        this.sphereRadius = params.sphereRadius as number ?? 1;
        this.sliceInside = params.sliceInside as boolean ?? false;
		this.showSlicer = params.showSlicer as boolean ?? false;
		this.enableSlicer = params.enableSlicer as boolean ?? false;

		if(this.showSlicer || this.enableSlicer) this.prepareSphereSlicerGeometry();
		this.toNextNode(this.enableSlicer ? this.sliceSphere() : this.structure!);

		return {renderingParams: this.sphereRenderingParams};
	}

	/**
	 * Channel handler for the change of plane params
	 *
	 * @param params - Parameters from the client
	 */
	private channelPlane(params: CtrlParams): CtrlParams {

        this.parallelA = params.parallelA as boolean ?? false;
        this.percentA = params.percentA as number ?? 50;
        this.parallelB = params.parallelB as boolean ?? false;
        this.percentB = params.percentB as number ?? 50;
        this.parallelC = params.parallelC as boolean ?? false;
        this.percentC = params.percentC as number ?? 50;
        this.sliceInside = params.sliceInside as boolean ?? false;
		this.showSlicer = params.showSlicer as boolean ?? false;
		this.enableSlicer = params.enableSlicer as boolean ?? false;

		if(this.showSlicer || this.enableSlicer) this.preparePlaneSlicerGeometry();
		this.toNextNode(this.enableSlicer ? this.slicePlane() : this.structure!);

		return {
			intersections: this.planeRenderingIntersections
		};
	}

	/**
	 * Channel handler for the change of Miller plane params
	 *
	 * @param params - Parameters from the client
	 */
	private channelMiller(params: CtrlParams): CtrlParams {

        this.millerH = params.millerH as number ?? 1;
        this.millerK = params.millerK as number ?? 0;
        this.millerL = params.millerL as number ?? 0;
		this.millerPlaneOffset = params.millerPlaneOffset as number ?? 0;
        this.sliceInside = params.sliceInside as boolean ?? false;
		this.showSlicer = params.showSlicer as boolean ?? false;
		this.enableSlicer = params.enableSlicer as boolean ?? false;

		if(this.showSlicer || this.enableSlicer) this.prepareMillerSlicerGeometry();
		this.toNextNode(this.enableSlicer ? this.slicePlane() : this.structure!);

		return {
			intersections: this.planeRenderingIntersections
		};
	}

	/**
	 * Channel handler for the change of slab params
	 *
	 * @param params - Parameters from the client
	 */
	private channelSlab(params: CtrlParams): CtrlParams {

        this.parallelA = params.parallelA as boolean ?? false;
        this.percentA = params.percentA as number ?? 50;
        this.parallelB = params.parallelB as boolean ?? false;
        this.percentB = params.percentB as number ?? 50;
        this.parallelC = params.parallelC as boolean ?? false;
        this.percentC = params.percentC as number ?? 50;
		this.thickness = params.thickness as number ?? 1;
        this.sliceInside = params.sliceInside as boolean ?? false;
		this.showSlicer = params.showSlicer as boolean ?? false;
		this.enableSlicer = params.enableSlicer as boolean ?? false;

		if(this.showSlicer || this.enableSlicer) this.prepareSlabSlicerGeometry();
		this.toNextNode(this.enableSlicer ? this.sliceSlab() : this.structure!);

		return {
			intersections1: this.planeRenderingIntersections,
			intersections2: this.planeRenderingIntersections2
		};
	}

	/**
	 * Channel handler for the change of direct atom selection parameters
	 *
	 * @param params - Parameters from the client
	 */
	private channelDirect(params: CtrlParams): void {

		this.selectorKind = params.selectorKind as SelectorType ?? "symbol";
		this.atomsSelector = params.atomsSelector as string ?? "";
        this.sliceInside = params.sliceInside as boolean ?? false;
		this.enableSlicer = params.enableSlicer as boolean ?? false;

		this.toNextNode(this.enableSlicer ? this.sliceDirect() : this.structure!);
	}

	/**
	 * Channel handler for the change of bonded atom selection parameters
	 *
	 * @param params - Parameters from the client
	 */
	private channelBonded(params: CtrlParams): void {

		this.selectorKind = params.selectorKind as SelectorType ?? "symbol";
		this.atomsSelector = params.atomsSelector as string ?? "";
        this.sliceInside = params.sliceInside as boolean ?? false;
		this.enableSlicer = params.enableSlicer as boolean ?? false;

		this.toNextNode(this.enableSlicer ? this.sliceBonded() : this.structure!);
	}

	/**
	 * Channel handler for the change of other parameters
	 *
	 * @param params - Parameters from the client
	 */
	private channelSet(params: CtrlParams): void {

        this.enableSlicer = params.enableSlicer as boolean ?? false;
        this.showSlicer = params.showSlicer as boolean ?? false;
        this.mode = params.mode as SlicingModes ?? "plane";

		if(this.structure) {
			if(this.enableSlicer || this.showSlicer) this.prepareSlicerGeometry();
			this.toNextNode(this.enableSlicer ? this.sliceStructure() : this.structure);
		}
	}
}
