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

	watchEffect(() => {

		// Access the scene
		const {scene} = sm;

		// Manage axis helper
		let axis = scene.getObjectByName("AxisHelper") as THREE.Group;
		if(configStore.helpers.showAxis) {

			if(axis) {
				axis.visible = true;
				if(configStore.helpers.axisLength !== axisLengthPrevious) {
					axis.clear();
					axisHelper(axis, configStore.helpers.axisLength);
					axisLengthPrevious = configStore.helpers.axisLength;
				}
			}
			else {
				axis = new THREE.Group();
				axis.name = "AxisHelper";
				scene.add(axis);
				axis.visible = true;
				axisHelper(axis, configStore.helpers.axisLength);
				axisLengthPrevious = configStore.helpers.axisLength;
			}
		}
		else if(axis) axis.visible = false;

		// Manage XZ helper plane
		let gridXZ = scene.getObjectByName("GridHelperXZ") as THREE.GridHelper;
		if(configStore.helpers.showGridXZ) {
			if(gridXZ) {
				gridXZ.visible = true;
				if(configStore.helpers.gridSize !== sidePrevious) {
					scene.remove(gridXZ);
					gridXZ.dispose();
					gridXZ = gridHelper("XZ", configStore.helpers.gridSize);
					gridXZ.visible = true;
					scene.add(gridXZ);
					sidePrevious = configStore.helpers.gridSize;
				}
			}
			else {
				gridXZ = gridHelper("XZ", configStore.helpers.gridSize);
				gridXZ.visible = true;
				scene.add(gridXZ);
				sidePrevious = configStore.helpers.gridSize;
			}
		}
		else if(gridXZ) gridXZ.visible = false;

		// Manage XY helper plane
		let gridXY = scene.getObjectByName("GridHelperXY") as THREE.GridHelper;
		if(configStore.helpers.showGridXY) {
			if(gridXY) {
				gridXY.visible = true;
				if(configStore.helpers.gridSize !== sidePrevious) {
					scene.remove(gridXY);
					gridXY.dispose();
					gridXY = gridHelper("XY", configStore.helpers.gridSize);
					gridXY.visible = true;
					scene.add(gridXY);
					sidePrevious = configStore.helpers.gridSize;
				}
			}
			else {
				gridXY = gridHelper("XY", configStore.helpers.gridSize);
				gridXY.visible = true;
				scene.add(gridXY);
				sidePrevious = configStore.helpers.gridSize;
			}
		}
		else if(gridXY) gridXY.visible = false;

		// Manage YZ helper plane
		let gridYZ = scene.getObjectByName("GridHelperYZ") as THREE.GridHelper;
		if(configStore.helpers.showGridYZ) {
			if(gridYZ) {
				gridYZ.visible = true;
				if(configStore.helpers.gridSize !== sidePrevious) {
					scene.remove(gridYZ);
					gridYZ.dispose();
					gridYZ = gridHelper("YZ", configStore.helpers.gridSize);
					gridYZ.visible = true;
					scene.add(gridYZ);
					sidePrevious = configStore.helpers.gridSize;
				}
			}
			else {
				gridYZ = gridHelper("YZ", configStore.helpers.gridSize);
				gridYZ.visible = true;
				scene.add(gridYZ);
				sidePrevious = configStore.helpers.gridSize;
			}
		}
		else if(gridYZ) gridYZ.visible = false;
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
