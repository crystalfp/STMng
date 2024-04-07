/**
 * Draw atom trajectories
 *
 * @packageDocumentation
 */
import * as THREE from "three";
import {sb, type UiParams} from "@/services/Switchboard";
import {sm} from "@/services/SceneManager";
import type {Structure} from "@/types";
import {selectAtomsByKind} from "@/services/SelectAtoms";

export class Trajectories {

	private showTrajectories = false;
	private labelKind = "symbol";
	private atomsSelector = "";
	private recording = false;
	private reset = false;
	private nextSteps = false;
	private maxDisplacement = 1;
	private maxDisplacementPrevious = 1;
	private readonly group = new THREE.Group();
	private readonly groupName;
	private readonly points: THREE.Vector3[][] = [];

	/**
	* Create the node
	*
	* @param id - ID of the Ortho Plane node
	*/
	constructor(private readonly id: string) {

		this.groupName = `Trajectories-${this.id}`;
		this.group.name = this.groupName;
		sm.add(this.group);

		sb.getUiParams(this.id, (params: UiParams) => {
			this.showTrajectories = params.showTrajectories as boolean ?? false;
			this.labelKind = params.labelKind as string ?? "symbol";
			this.atomsSelector = params.atomsSelector as string ?? "";
			this.recording = params.recording as boolean ?? false;
			this.reset = params.reset as boolean ?? false;
			this.maxDisplacement = params.maxDisplacement as number ?? 1;

			if(this.reset) {
				this.reset = false;
				sb.setUiParams(this.id, {
					reset: false
				});

				this.points.length = 0;
				sm.clearGroup(this.groupName);

				this.nextSteps = false;
			}

			if(this.maxDisplacement !== this.maxDisplacementPrevious) {

				this.drawLines();
				this.maxDisplacementPrevious = this.maxDisplacement;
			}

			this.group.visible = this.showTrajectories;
			if(!this.recording) this.nextSteps = false;
		});

		sb.getData(this.id, (data: unknown) => {

			if(!this.recording) return;

			const structure = data as Structure;
			const {atoms} = structure;
			const indices = selectAtomsByKind(structure, this.labelKind, this.atomsSelector);

			// First step, initialize set of coordinates
			if(this.recording && !this.nextSteps) {
				this.nextSteps = true;

				this.points.length = 0;
				const len = indices.length;
				for(let i=0; i < len; ++i) this.points.push([]);
			}

			// Record coordinates
			let trajectoryIndex = 0;
			for(const idx of indices) {
				const {position} = atoms[idx];
				this.points[trajectoryIndex]
					.push(new THREE.Vector3(position[0], position[1], position[2]));
				++trajectoryIndex;
			}

			// Create lines
			this.drawLines();
		});
	}

	/**
	 * Draw trajectory lines (split in segments to avoid big jumps)
	 */
	private drawLines(): void {

		sm.clearGroup(this.groupName);
		for(const points of this.points) {

			const segments = this.splitSegments(points, this.maxDisplacement);

			for(const segment of segments) {
				const geometry = new THREE.BufferGeometry().setFromPoints(segment);
				const material = new THREE.LineBasicMaterial({color: 0x0000FF});
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
