/**
 * Slice structure along a plane or a sphere
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-04-09
 */
import {hasNoUnitCell} from "../modules/Helpers";
import {NodeCore} from "../modules/NodeCore";
import {selectAtomsByKind, type SelectorType} from "../modules/AtomsChooser";
import {EmptyStructure} from "../modules/EmptyStructure";
import type {Structure, ChannelDefinition, CtrlParams, BasisType} from "@/types";
import {findIntersections} from "../modules/UnitCellIntersections";
import {getAtomData} from "../modules/AtomData";

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
	private mode = "plane"; // "plane", "sphere", "miller", "slab"

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

	private millerPlaneNormal: number[] = [];
	private millerPlanePoint: number[] = [];

	private readonly channels: ChannelDefinition[] = [
		{name: "init",      type: "invoke", callback: this.channelInit.bind(this)},
		{name: "sphere",	type: "invoke",	callback: this.channelSphere.bind(this)},
		{name: "plane",		type: "invoke",	callback: this.channelPlane.bind(this)},
		{name: "miller",	type: "invoke",	callback: this.channelMiller.bind(this)},
		{name: "slab",		type: "invoke",	callback: this.channelSlab.bind(this)},
		{name: "set",		type: "send", 	callback: this.channelSet.bind(this)},
		{name: "offset",	type: "invoke",	callback: this.channelOffset.bind(this)},
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

		if(!data || data.atoms.length === 0) return;
		this.structure = data;

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
		this.mode = params.mode as string ?? "plane";
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
	 * Slice structure according to the mode
	 *
	 * @returns Sliced structure
	 */
	private sliceStructure(): Structure {

		if(!this.structure) return new EmptyStructure();

		if(this.mode === "sphere") {
			const selectedIdx = selectAtomsByKind(this.structure,
												  this.selectorKind, this.atomsSelector);
			return this.sliceSphere(selectedIdx);
		}

		if(hasNoUnitCell(this.structure.crystal.basis)) {
			return this.structure;
		}

		switch(this.mode) {
			case "plane":  return this.slicePlane();
			case "miller": return this.sliceMiller();
			case "slab":   return this.sliceSlab();
		}
		return this.structure;
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
	 * Slice structure according to a sphere and save the center coordinates
	 *
	 * @param centerAtomsIdx - Indices of center atoms
	 * @returns Structure with atoms sliced by the sphere
	 */
	private sliceSphere(centerAtomsIdx: number[]): Structure {

		const natoms = this.structure!.atoms.length;
		const inside = Array<boolean>(natoms).fill(false);
		this.sphereRenderingParams.length = 0;

		for(const idx of centerAtomsIdx) {

			const center = this.structure!.atoms[idx].position;
			this.sphereRenderingParams.push(center[0], center[1], center[2]);

			for(let i=0; i < natoms; ++i) {

				const {position} = this.structure!.atoms[i];
				const distance = Math.hypot(position[0]-center[0],
										    position[1]-center[1],
										    position[2]-center[2]);

				if(distance <= this.sphereRadius) inside[i] = true;
			}
		}

		return this.selectAtoms(inside);
	}

	/**
	 * Compute cross product and normalize result
	 *
	 * @param a - First vector
	 * @param aStart - Index in which start the coordinates in the first vector
	 * @param b - Second vector
	 * @param bStart - Index in which start the coordinates in the second vector
	 * @returns Normalized vector resulting from cross product of the two vectors
	 */
	private crossProductAndNormalize(a: number[], aStart: number, b: number[], bStart: number): number[] {

		// A x B = (AyBz − AzBy, AzBx − AxBz, AxBy − AyBx)

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
	 * @param parallelCode - To which axis the plane is parallel:
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
	 * Slice structure according to a plane and save the plane intersections with the unit cell
	 *
	 * @returns Sliced structure
	 */
	private slicePlane(): Structure {

		const pa = this.percentA/100;
		const pb = this.percentB/100;
		const pc = this.percentC/100;

		const {crystal, atoms} = this.structure!;
		const {basis, origin} = crystal;
		const natoms = atoms.length;

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

		const parallelCode = (this.parallelA ? 1 : 0) + (this.parallelB ? 2 : 0) + (this.parallelC ? 4 : 0);

		const {normal, point} = this.createPlane(points, parallelCode, basis);

		this.planeRenderingIntersections = findIntersections(basis, origin, normal, point).flat();

		const inside = Array<boolean>(natoms).fill(false);

		for(let i=0; i < natoms; ++i) {
			const {position} = atoms[i];
			const dot = normal[0]*(position[0]-point[0]) +
						normal[1]*(position[1]-point[1]) +
						normal[2]*(position[2]-point[2]);
			if(dot >= 0) inside[i] = true;
		}

		return this.selectAtoms(inside);
	}

	/**
	 * Slice according to a plane identified by its (hkl) Miller indices
	 *
	 * @returns Sliced structure
	 */
	private sliceMiller(): Structure {

		const {crystal, atoms} = this.structure!;
		const {basis, origin} = crystal;
		const natoms = atoms.length;
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

		this.millerPlaneNormal = normal;
		this.millerPlanePoint = point;

		if(this.millerPlaneOffset !== 0) {
			point[0] += this.millerPlaneOffset*normal[0];
			point[1] += this.millerPlaneOffset*normal[1];
			point[2] += this.millerPlaneOffset*normal[2];
		}

		this.planeRenderingIntersections = findIntersections(basis, origin, normal, point).flat();

		const inside = Array<boolean>(natoms).fill(false);

		for(let i=0; i < natoms; ++i) {
			const {position} = atoms[i];
			const dot = normal[0]*(position[0]-point[0]) +
						normal[1]*(position[1]-point[1]) +
						normal[2]*(position[2]-point[2]);
			if(dot >= 0) inside[i] = true;
		}

		return this.selectAtoms(inside);
	}

	/**
	 * Compute area of the plane inside the unit cell
	 *
	 * @param intersections - Coordinates of the points of intersection between the plane and the unit cell
	 * @returns Area of the plane inside the unit cell
	 */
	private computeArea(intersections: number[][]): number {

		let area = 0;
		for(let i=2; i < intersections.length; ++i) {
			// a: 0, b: i-1, c: i
			const v0 = [intersections[i][0]-intersections[i-1][0],
						intersections[i][1]-intersections[i-1][1],
						intersections[i][2]-intersections[i-1][2]];

			const v1 = [intersections[0][0]-intersections[i-1][0],
						intersections[0][1]-intersections[i-1][1],
						intersections[0][2]-intersections[i-1][2]];
			// _v0.subVectors( this.c, this.b );
			// _v1.subVectors( this.a, this.b );
			// A x B = (AyBz − AzBy, AzBx − AxBz, AxBy − AyBx)

			const cross = [
				v0[1]*v1[2] - v0[2]*v1[1],
				v0[2]*v1[0] - v0[0]*v1[2],
				v0[0]*v1[1] - v0[1]*v1[0]
			];
			area += Math.hypot(cross[0], cross[1], cross[2])*0.5;
		}

		return area;
	}

	/**
	 * Compute the area energy of the plane due to cutting bonds
	 *
	 * @param offset - Offset of the Miller plane from the computed position
	 * @returns Energy of the plane. Zero if no intersection with bonds
	 */
	private areaEnergy(offset: number): number {

		const {crystal, atoms, bonds} = this.structure!;
		const {basis, origin} = crystal;

		const point = [
			this.millerPlanePoint[0] + offset*this.millerPlaneNormal[0],
			this.millerPlanePoint[1] + offset*this.millerPlaneNormal[1],
			this.millerPlanePoint[2] + offset*this.millerPlaneNormal[2]
		];

		const intersections = findIntersections(basis, origin,
												this.millerPlaneNormal, point);

		if(intersections.length === 0) return 0;

		const area = this.computeArea(intersections);

		let strength = 0;
		for(const bond of bonds) {

			const {from, to, type} = bond;
			if(type !== 0) continue;

			const {position: pFrom, atomZ: zFrom} = atoms[from];

			const dotFrom = this.millerPlaneNormal[0]*(pFrom[0]-this.millerPlanePoint[0]) +
							this.millerPlaneNormal[1]*(pFrom[1]-this.millerPlanePoint[1]) +
							this.millerPlaneNormal[2]*(pFrom[2]-this.millerPlanePoint[2]);

			const {position: pTo, atomZ: zTo} = atoms[to];

			const dotTo = this.millerPlaneNormal[0]*(pTo[0]-this.millerPlanePoint[0]) +
						  this.millerPlaneNormal[1]*(pTo[1]-this.millerPlanePoint[1]) +
						  this.millerPlaneNormal[2]*(pTo[2]-this.millerPlanePoint[2]);

			if((dotFrom >= 0 && dotTo < 0) || (dotFrom < 0 && dotTo >= 0)) {

				const strengthFrom = getAtomData(zFrom).bondStrength;
				const strengthTo   = getAtomData(zTo).bondStrength;

				strength += Math.sqrt(strengthFrom*strengthTo);
			}
		}

		return area*strength;
	}

	/**
	 * Compute the offset that gives the minimum of area energy
	 *
	 * @returns The minimal area energy
	 */
	private optimizeOffset(maxOffset: number, step: number): number {

		let minEnergy = this.areaEnergy(0);
		let minOffset = 0;

		for(let offset=0; offset < maxOffset; offset += step) {

			const energyP = this.areaEnergy(offset);
			if(energyP > 0 && energyP < minEnergy) {
				minEnergy = energyP;
				minOffset = offset;
			}

			const energyN = this.areaEnergy(-offset);
			if(energyN > 0 && energyN < minEnergy) {
				minEnergy = energyN;
				minOffset = -offset;
			}

			if(energyN === 0 && energyP === 0) break;
		}

		this.millerPlaneOffset = minOffset;

		return minEnergy;
	}

	/**
	 * Slice the structure inside or outside two parallel planes
	 *
	 * @returns The sliced structure
	 */
	private sliceSlab(): Structure {

		const pa = this.percentA/100;
		const pb = this.percentB/100;
		const pc = this.percentC/100;

		const {crystal, atoms} = this.structure!;
		const {basis, origin} = crystal;
		const natoms = atoms.length;

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

		const parallelCode = (this.parallelA ? 1 : 0) + (this.parallelB ? 2 : 0) + (this.parallelC ? 4 : 0);

		const {normal, point} = this.createPlane(points, parallelCode, basis);

		const pt1 = [
			point[0]+normal[0]*this.thickness/2,
			point[1]+normal[1]*this.thickness/2,
			point[2]+normal[2]*this.thickness/2
		];
		const pt2 = [
			point[0]-normal[0]*this.thickness/2,
			point[1]-normal[1]*this.thickness/2,
			point[2]-normal[2]*this.thickness/2
		];

		this.planeRenderingIntersections  = findIntersections(basis, origin, normal, pt1).flat();
		this.planeRenderingIntersections2 = findIntersections(basis, origin, normal, pt2).flat();

		const inside = Array<boolean>(natoms).fill(false);
		for(let i=0; i < natoms; ++i) {
			const {position} = atoms[i];
			const dot1 = normal[0]*(position[0]-pt1[0]) +
						 normal[1]*(position[1]-pt1[1]) +
						 normal[2]*(position[2]-pt1[2]);
			const dot2 = normal[0]*(position[0]-pt2[0]) +
						 normal[1]*(position[1]-pt2[1]) +
						 normal[2]*(position[2]-pt2[2]);
			if(dot1 <= 0 && dot2 >= 0) inside[i] = true;
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

		this.toNextNode(this.sliceStructure());

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

		this.toNextNode(this.sliceStructure());

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

		this.toNextNode(this.sliceStructure());

		return {
			intersections: this.planeRenderingIntersections
		};
	}

	/**
	 * Channel handler for the change of Miller plane offset from the computed position
	 */
	private channelOffset(): CtrlParams {

		const energy = this.optimizeOffset(10, 0.1);

		this.toNextNode(this.sliceStructure());

		return {
			intersections: this.planeRenderingIntersections,
			millerPlaneOffset: this.millerPlaneOffset,
			minEnergy: energy
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

		this.toNextNode(this.sliceStructure());

		return {
			intersections1: this.planeRenderingIntersections,
			intersections2: this.planeRenderingIntersections2
		};
	}

	/**
	 * Channel handler for the change of other parameters
	 *
	 * @param params - Parameters from the client
	 */
	private channelSet(params: CtrlParams): void {

        this.enableSlicer = params.enableSlicer as boolean ?? false;
        this.showSlicer = params.showSlicer as boolean ?? false;
        this.mode = params.mode as string ?? "plane";

		if(this.structure) this.toNextNode(this.enableSlicer ? this.sliceStructure() : this.structure);
	}
}
