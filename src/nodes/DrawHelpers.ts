/**
 * Show helper objects: Axis and Grid.
 *
 * @packageDocumentation
 */

import * as THREE from "three";
import SpriteText from "three-spritetext";
import {sb, type UiParams} from "@/services/Switchboard";
import {sm} from "@/services/SceneManager";

export class DrawHelpers {

	private showAxis = false;
	private showGridXZ = false;
	private showGridXY = false;
	private showGridYZ = false;
	private side = 10;
	private sidePrevious = 10;

	constructor(private readonly id: string) {

		let gridXZ = this.gridHelper("XZ");
		sm.add(gridXZ);
		let gridXY = this.gridHelper("XY");
		sm.add(gridXY);
		let gridYZ = this.gridHelper("YZ");
		sm.add(gridYZ);
		const axis = this.axisHelper();
		sm.add(axis);

		sb.getUiParams(this.id, (params: UiParams) => {

    		this.showAxis   = params.showAxis as boolean ?? false;
    		this.showGridXZ = params.showGridXZ as boolean ?? false;
    		this.showGridXY = params.showGridXY as boolean ?? false;
    		this.showGridYZ = params.showGridYZ as boolean ?? false;
			this.side = params.gridSize as number ?? 10;

			gridXZ.visible = this.showGridXZ;
			gridXY.visible = this.showGridXY;
			gridYZ.visible = this.showGridYZ;
			axis.visible   = this.showAxis;

			if(this.side !== this.sidePrevious) {

				const scene = sm.accessScene();

				let obj = scene.getObjectByName("GridHelperXZ") as THREE.GridHelper;
				if(obj) {
					scene.remove(obj);
					obj.dispose();
					gridXZ = this.gridHelper("XZ");
					scene.add(gridXZ);
				}
				obj = scene.getObjectByName("GridHelperXY") as THREE.GridHelper;
				if(obj) {
					scene.remove(obj);
					obj.dispose();
					gridXY = this.gridHelper("XY");
					scene.add(gridXY);
				}
				obj = scene.getObjectByName("GridHelperYZ") as THREE.GridHelper;
				if(obj) {
					scene.remove(obj);
					obj.dispose();
					gridYZ = this.gridHelper("YZ");
					scene.add(gridYZ);
				}
				this.sidePrevious = this.side;
			}
		});
	}

	/**
	 * Create a group containing the axis
	 *
	 * @returns The group containing the axis to be added to the scene
	 */
	private axisHelper(): THREE.Group {

		const group = new THREE.Group();
		group.name = "AxisHelper";

		const originZero = new THREE.Vector3(0, 0, 0);
		const arrowX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0),
													originZero, 1,
													0xFF0000, 0.4, 0.2);
		const arrowY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0),
													originZero, 1,
													0x00FF00, 0.4, 0.2);
		const arrowZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1),
													originZero, 1,
													0x0000FF, 0.4, 0.2);
		group.add(arrowX, arrowY, arrowZ);

		const spriteX = new SpriteText("x", 0.3, "#FF0000");
		spriteX.fontSize = 180;
		spriteX.position.set(1.1, 0, 0);

		const spriteY = new SpriteText("y", 0.3, "#00FF00");
		spriteY.fontSize = 180;
		spriteY.position.set(0, 1.2, 0);

		const spriteZ = new SpriteText("z", 0.3, "#0000FF");
		spriteZ.fontSize = 180;
		spriteZ.position.set(0, 0, 1.1);

		group.add(spriteX, spriteY, spriteZ);

		return group;
	}

	/**
	 * Create the grid
	 *
	 * @returns The grid to be added to the scene
	 */
	private gridHelper(plane: "XZ" | "XY" | "YZ"): THREE.GridHelper {

		const grid = new THREE.GridHelper(this.side, this.side, "red");
		grid.name = `GridHelper${plane}`;

		if(plane === "XY") {
			grid.rotateX(Math.PI / 2);
		}
		else if(plane === "YZ") {
			grid.rotateZ(Math.PI / 2);
		}
		return grid;
	}

	saveStatus(): string {

		const statusToSave = {

			showAxis: this.showAxis,
			showGridXZ: this.showGridXZ,
			showGridXY: this.showGridXY,
			showGridYZ: this.showGridYZ,
			side: this.side
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
