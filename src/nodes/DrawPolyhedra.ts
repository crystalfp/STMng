
import * as THREE from "three";
import {ConvexGeometry} from "three/addons/geometries/ConvexGeometry.js";
import {sb, type UiParams} from "@/services/Switchboard";
import type {Structure} from "@/types";
import {sm} from "@/services/SceneManager";

export class DrawPolyhedra {

	private readonly points: THREE.Vector3[] = [];
	private readonly mesh = new THREE.Mesh();
	private readonly material = new THREE.MeshLambertMaterial({
										color: "#FFFFFF",
										opacity: 0.5,
										side: THREE.FrontSide,
										transparent: true
									});
	private color = "#FFFFFF80";

	constructor(private readonly id: string) {

		const scene = sm.accessScene();
		scene.add(this.mesh);

		sb.getUiParams(this.id, (params: UiParams) => {

			this.mesh.visible = params.showPolyhedra as boolean ?? false;
			this.color = params.surfaceColor as string ?? "#FFFFFF80";

			this.material.opacity = this.extractOpacity(this.color);
			this.material.color = this.extractColor(this.color);
		});

		sb.getData(this.id, (data: unknown) => {

			const {atoms} = (data as Structure);
			if(!atoms) return;
			if(atoms.length < 4) return;

			// Create points from atoms positions
			this.points.length = 0;
			for(const atom of atoms) {
				const pos = atom.position;
				this.points.push(new THREE.Vector3(pos[0], pos[1], pos[2]));
			}

			// Update polyhedra
			this.mesh.geometry = new ConvexGeometry(this.points);
			this.mesh.material = this.material;
		});
	}

	private extractColor(color: string): THREE.Color {

		const colorString = color.slice(0, 7);
		return new THREE.Color(colorString);
	}

	private extractOpacity(color: string): number {

		if(color.length < 9) return 1;
		return Number.parseInt(color.slice(7, 9), 16) / 255;
	}

	saveStatus(): string {

		const statusToSave = {

			showPolyhedra: this.mesh.visible,
			color: this.color,
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
