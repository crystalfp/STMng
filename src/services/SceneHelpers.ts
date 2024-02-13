/**
 * Show helper objects: axis and axis aligned grids.
 *
 * @packageDocumentation
 */

import * as THREE from "three";
import {watchEffect} from "vue";
import SpriteText from "three-spritetext";
import {sm} from "@/services/SceneManager";
import {useConfigStore} from "@/stores/configStore";

let sidePrevious = 10;
let axisLengthPrevious = 1;
const originZero = new THREE.Vector3(0, 0, 0);

export const setupSceneHelpers = (): void => {

	// Access the stores
	const configStore = useConfigStore();

	let gridXZ = gridHelper("XZ", configStore.helpers.gridSize);
	sm.add(gridXZ);
	let gridXY = gridHelper("XY", configStore.helpers.gridSize);
	sm.add(gridXY);
	let gridYZ = gridHelper("YZ", configStore.helpers.gridSize);
	sm.add(gridYZ);
	const axis = new THREE.Group();
	axis.name = "AxisHelper";
	sm.add(axis);
	axisHelper(axis, configStore.helpers.axisLength);

	watchEffect(() => {

		gridXZ.visible = configStore.helpers.showGridXZ;
		gridXY.visible = configStore.helpers.showGridXY;
		gridYZ.visible = configStore.helpers.showGridYZ;
		axis.visible   = configStore.helpers.showAxis;

		const {scene} = sm;

		if(configStore.helpers.axisLength !== axisLengthPrevious) {

			const obj =  scene.getObjectByName("AxisHelper") as THREE.Group;
			if(obj) {
				obj.clear();
				axisHelper(obj, configStore.helpers.axisLength);
			}
			axisLengthPrevious = configStore.helpers.axisLength;
		}

		if(configStore.helpers.gridSize !== sidePrevious) {

			let obj = scene.getObjectByName("GridHelperXZ") as THREE.GridHelper;
			if(obj) {
				scene.remove(obj);
				obj.dispose();
				gridXZ = gridHelper("XZ", configStore.helpers.gridSize);
				gridXZ.visible = configStore.helpers.showGridXZ;
				scene.add(gridXZ);
			}
			obj = scene.getObjectByName("GridHelperXY") as THREE.GridHelper;
			if(obj) {
				scene.remove(obj);
				obj.dispose();
				gridXY = gridHelper("XY", configStore.helpers.gridSize);
				gridXY.visible = configStore.helpers.showGridXY;
				scene.add(gridXY);
			}
			obj = scene.getObjectByName("GridHelperYZ") as THREE.GridHelper;
			if(obj) {
				scene.remove(obj);
				obj.dispose();
				gridYZ = gridHelper("YZ", configStore.helpers.gridSize);
				gridYZ.visible = configStore.helpers.showGridYZ;
				scene.add(gridYZ);
			}
			sidePrevious = configStore.helpers.gridSize;
		}
	});
};

/**
 * Fill a group with the axis
 *
 * @param group - The group that will contains the axis to be added to the scene
 */
const axisHelper = (group: THREE.Group, axisLength: number): void => {

	const arrowX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0),
												originZero, axisLength,
												0xFF0000, 0.4, 0.2);
	const arrowY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0),
												originZero, axisLength,
												0x79FF00, 0.4, 0.2);
	const arrowZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1),
												originZero, axisLength,
												0x0000FF, 0.4, 0.2);
	group.add(arrowX, arrowY, arrowZ);

	const spriteX = new SpriteText("x", 0.3, "#FF0000");
	spriteX.fontSize = 180;
	spriteX.position.set(axisLength+0.1, 0, 0);

	const spriteY = new SpriteText("y", 0.3, "#79FF00");
	spriteY.fontSize = 180;
	spriteY.position.set(0, axisLength+0.2, 0);

	const spriteZ = new SpriteText("z", 0.3, "#0000FF");
	spriteZ.fontSize = 180;
	spriteZ.position.set(0, 0, axisLength+0.1);

	group.add(spriteX, spriteY, spriteZ);
};

/**
 * Create the grid
 *
 * @returns The grid to be added to the scene
 */
const gridHelper = (plane: "XZ" | "XY" | "YZ", gridSide: number): THREE.GridHelper => {

	const grid = new THREE.GridHelper(gridSide, gridSide, "#FF0000");
	grid.name = `GridHelper${plane}`;

	if(plane === "XY") {
		grid.rotateX(Math.PI / 2);
	}
	else if(plane === "YZ") {
		grid.rotateZ(Math.PI / 2);
	}
	return grid;
};
