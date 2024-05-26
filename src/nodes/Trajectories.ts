/**
 * Draw atom trajectories
 *
 * @packageDocumentation
 */
import * as THREE from "three";
import {sb, type UiParams} from "@/services/Switchboard";
import {sm} from "@/services/SceneManager";
import type {Structure, PositionType, BasisType} from "@/types";
import {selectAtomsByKind, type SelectorType} from "@/services/SelectAtoms";
import {useControlStore} from "@/stores/controlStore";
import {watchEffect} from "vue";

export class Trajectories {

	private showTrajectories = false;
	private labelKind: SelectorType = "symbol";
	private atomsSelector = "";
	private reset = false;
	private nextSteps = false;
	private maxDisplacement = 1;
	private maxDisplacementPrevious = 1;
	private readonly group = new THREE.Group();
	private readonly groupName;
	private readonly points: THREE.Vector3[][] = [];
	private showPositionClouds = false;
	private positionCloudsSide = 10;
	private readonly positionCloud = Array(this.positionCloudsSide*
										   this.positionCloudsSide*
										   this.positionCloudsSide).fill(0) as number[];
	private positionLimits: number[] = [];
	private readonly traceColor: string[] = [];

	/**
	 * Create the node
	 *
	 * @param id - ID of the Ortho Plane node
	 */
	constructor(private readonly id: string) {

		this.groupName = `Trajectories-${this.id}`;
		this.group.name = this.groupName;
		sm.add(this.group);

		const controlStore = useControlStore();

		sb.getUiParams(this.id, (params: UiParams) => {
			this.showTrajectories = params.showTrajectories as boolean ?? false;
			this.labelKind = params.labelKind as SelectorType ?? "symbol";
			this.atomsSelector = params.atomsSelector as string ?? "";
			this.reset = params.reset as boolean ?? false;
			this.maxDisplacement = params.maxDisplacement as number ?? 1;

			if(this.reset) {
				this.reset = false;
				sb.setUiParams(this.id, {
					reset: false
				});

				this.points.length = 0;
				this.traceColor.length = 0;
				sm.clearGroup(this.groupName);

				this.nextSteps = false;

				this.positionCloud.fill(0);
			}

			if(this.maxDisplacement !== this.maxDisplacementPrevious) {

				this.drawLines();
				this.maxDisplacementPrevious = this.maxDisplacement;
			}

			this.group.visible = this.showTrajectories;

			this.showPositionClouds = params.showPositionClouds as boolean ?? false;
			this.positionCloudsSide = params.positionCloudsSide as number ?? 10;
		});

		sb.getData(this.id, (data: unknown) => {

			if(!controlStore.trajectoriesRecording) return;

			const structure = data as Structure;
			const {atoms, crystal} = structure;
			const indices = selectAtomsByKind(structure, this.labelKind, this.atomsSelector);

			this.setTraceColor(structure, indices, this.traceColor);

			// First step, initialize set of coordinates
			if(controlStore.trajectoriesRecording && !this.nextSteps) {
				this.nextSteps = true;

				this.points.length = 0;
				const len = indices.length;
				for(let i=0; i < len; ++i) this.points.push([]);

				if(this.showPositionClouds) {
					this.positionCloud.fill(0);
					const {origin, basis} = crystal;
					this.computeLimits(origin, basis);
				}
			}

			// Record coordinates
			let trajectoryIndex = 0;
			for(const idx of indices) {
				const {position} = atoms[idx];
				this.points[trajectoryIndex]
					.push(new THREE.Vector3(position[0], position[1], position[2]));
				++trajectoryIndex;
				if(this.showPositionClouds) this.accumulatePosition(position[0], position[1], position[2]);
			}

			// Create lines
			this.drawLines();

			// Create volume
			if(this.showPositionClouds) this.drawPositionClouds();
		});

		watchEffect(() => {
			if(!controlStore.trajectoriesRecording) this.nextSteps = false;
		});

		// Show this module has been mounted
		controlStore.hasTrajectory = true;
	}

	private computeLimits(orig: PositionType, basis: BasisType): void {

		const vv: number[] = [
/* 0 */ orig[0],                            orig[1],                            orig[2],
/* 1 */ orig[0]+basis[0],                   orig[1]+basis[1],                   orig[2]+basis[2],
/* 2 */ orig[0]+basis[0]+basis[3],          orig[1]+basis[1]+basis[4],          orig[2]+basis[2]+basis[5],
/* 3 */ orig[0]+basis[3],                   orig[1]+basis[4],                   orig[2]+basis[5],
/* 4 */ orig[0]+basis[6],                   orig[1]+basis[7],                   orig[2]+basis[8],
/* 5 */ orig[0]+basis[0]+basis[6],          orig[1]+basis[1]+basis[7],          orig[2]+basis[2]+basis[8],
/* 6 */ orig[0]+basis[0]+basis[3]+basis[6], orig[1]+basis[1]+basis[4]+basis[7], orig[2]+basis[2]+basis[5]+basis[8],
/* 7 */ orig[0]+basis[3]+basis[6],          orig[1]+basis[4]+basis[7],          orig[2]+basis[5]+basis[8],
		];

		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let minZ = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		let maxZ = Number.NEGATIVE_INFINITY;
		for(let i=0; i < 8; ++i) {
			if(vv[3*i] > maxX)   maxX = vv[3*i];
			if(vv[3*i+1] > maxY) maxY = vv[3*i+1];
			if(vv[3*i+2] > maxZ) maxZ = vv[3*i+2];
			if(vv[3*i] < minX)   minX = vv[3*i];
			if(vv[3*i+1] < minY) minY = vv[3*i+1];
			if(vv[3*i+2] < minZ) minZ = vv[3*i+2];
		}

		this.positionLimits = [
			minX,
			minY,
			minZ,
			maxX-minX,
			maxY-minY,
			maxZ-minZ,
		];
	}

	private accumulatePosition(x: number, y: number, z: number): void {

		const ix = Math.floor((x-this.positionLimits[0])/this.positionLimits[3]);
		const iy = Math.floor((y-this.positionLimits[1])/this.positionLimits[4]);
		const iz = Math.floor((z-this.positionLimits[2])/this.positionLimits[5]);

		++this.positionCloud[ix+this.positionCloudsSide*(iy+this.positionCloudsSide*iz)];
	}

	private drawPositionClouds(): void {
		// console.log(this.positionCloud);
	}

	/**
	 * Draw trajectory lines (split in segments to avoid big jumps)
	 */
	private drawLines(): void {

		sm.clearGroup(this.groupName);
		let idx = 0;
		for(const points of this.points) {

			const segments = this.splitSegments(points, this.maxDisplacement);
			const color = this.traceColor[idx++];
			for(const segment of segments) {
				const geometry = new THREE.BufferGeometry().setFromPoints(segment);
				const material = new THREE.LineBasicMaterial({color});
				const line = new THREE.Line(geometry, material);
				this.group.add(line);
			}
		}
	}

	/**
	 * Split a trajectory in segments with steps' lengths less than a maximum
	 *
	 * @param points - Points along a path
	 * @param maxLength - Max length of each segment
	 * @returns An array of segments points
	 */
	private splitSegments(points: THREE.Vector3[], maxLength: number): THREE.Vector3[][] {

		// Sanity check
		const npoints = points.length;
		if(npoints < 2) return [];

		const segments: THREE.Vector3[][] = [];
		let segmentStartIndex = 0;
		for(let i=1; i < npoints; ++i) {

			const length = points[i].distanceTo(points[i-1]);
			if(length > maxLength) {

				// Finish previous segment
				if((i-segmentStartIndex) > 1) {
					segments.push(points.slice(segmentStartIndex, i));
				}

				// Start new segment
				segmentStartIndex = i;
			}
		}

		// Output last segment
		if((npoints - segmentStartIndex) > 1) {
			segments.push(points.slice(segmentStartIndex));
		}

		return segments;
	}

	/**
	 * Extract the trace colors as the atom type color
	 *
	 * @param structure - The structure
	 * @param indices - Indices of the selected atoms
	 * @param traceColor - The resulting colors
	 */
	private setTraceColor(structure: Structure,
						  indices: number[],
						  traceColor: string[]): void {

		traceColor.length = 0;
		const {atoms, look} = structure;
		for(const idx of indices) {
			const {atomZ} = atoms[idx];
			traceColor.push(look[atomZ].color);
		}
	}

	/**
	* Save the node status
	*
	* @returns The JSON formatted status to be saved
	*/
	saveStatus(): string {

        const statusToSave = {
			showTrajectories: this.showTrajectories,
			labelKind: this.labelKind,
			atomsSelector: this.atomsSelector,
			maxDisplacement: this.maxDisplacement,
        };
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
