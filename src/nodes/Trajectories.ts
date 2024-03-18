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

			if(this.reset) {
				this.reset = false;
				sb.setUiParams(this.id, {
					reset: false
				});

				this.points.length = 0;
				sm.clearGroup(this.groupName);

				this.nextSteps = false;
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
			sm.clearGroup(this.groupName);
			for(const points of this.points) {
				const geometry = new THREE.BufferGeometry().setFromPoints(points);
				const material = new THREE.LineBasicMaterial({color: 0x0000FF});
				const line = new THREE.Line(geometry, material);
				this.group.add(line);
			}
		});
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
        };
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
