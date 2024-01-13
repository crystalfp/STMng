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
	private showGrid = false;
	private side = 10;
	private sidePrevious = 10;

	constructor(private readonly id: string) {

		const scene = sm.accessScene();
		let grid = this.gridHelper();
		scene.add(grid);
		const axis = this.axisHelper();
		scene.add(axis);

		sb.getUiParams(this.id, (params: UiParams) => {

    		this.showAxis = params.showAxis as boolean ?? false;
    		this.showGrid = params.showGrid as boolean ?? false;
			this.side = params.gridSize as number ?? 10;

			grid.visible = this.showGrid;
			axis.visible = this.showAxis;

			if(this.side !== this.sidePrevious) {

				const obj = scene.getObjectByName("GridHelper") as THREE.GridHelper;
				if(obj) {
					scene.remove(obj);
					obj.dispose();
					grid = this.gridHelper();
					scene.add(grid);
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
	private gridHelper(): THREE.GridHelper {

		const grid = new THREE.GridHelper(this.side, this.side, "red");
		grid.name = "GridHelper";

		return grid;
	}

	saveStatus(): string {

		const statusToSave = {

			showAxis: this.showAxis,
			showGrid: this.showGrid,
			side: this.side
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
