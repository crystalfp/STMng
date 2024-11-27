/**
 * Show helper objects: axis and axis aligned grids.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import * as THREE from "three";
import {watchEffect, watch} from "vue";
import {sm} from "./SceneManager";
import {useConfigStore} from "@/stores/configStore";
import {spriteText} from "./SpriteText";
import {storeToRefs} from "pinia";

let sidePrevious = 10;
let axisLengthPrevious = 1;

/**
 * Create the helpers
 */
export const setupSceneHelpers = (): void => {

	// Access the stores
	const configStore = useConfigStore();

	const {helpers} = storeToRefs(configStore);
	watch(helpers, () => {
		sm.modified();
	}, {deep: true});

	watchEffect(() => {

		// Access the scene and set it modified
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
 * Create the grid
 *
 * @returns The grid to be added to the scene
 */
const gridHelper = (plane: "XZ" | "XY" | "YZ", gridSide: number): THREE.GridHelper => {

	const grid = new THREE.GridHelper(gridSide, gridSide, "#FF0000");
	grid.name = "GridHelper" + plane;

	if(plane === "XY") {
		grid.rotateX(Math.PI / 2);
	}
	else if(plane === "YZ") {
		grid.rotateZ(Math.PI / 2);
	}
	return grid;
};

/**
 * Fill the group with the axis versors
 *
 * @param group - The group that will contains the axis to be added to the scene
 * @param axisLength - Length of each arrow
 */
const axisHelper = (group: THREE.Group, axisLength: number): void => {

	const size = 0.05;
	const coneSize = 2*size;
	const coneLen = 5*size;
	const conePosition = axisLength+size;
	const labelPosition = axisLength+coneLen;

	// Axis
	const cylinderX = new THREE.Mesh(
		new THREE.CylinderGeometry(size, size, axisLength, 10),
		new THREE.MeshBasicMaterial({color: 0xFF0000}) // Red - X
	);
	cylinderX.position.set(axisLength/2, 0, 0);
	cylinderX.rotation.set(0, 0, Math.PI / 2);

	const cylinderY = new THREE.Mesh(
		new THREE.CylinderGeometry(size, size, axisLength, 10),
		new THREE.MeshBasicMaterial({color: 0x79FF00}) // Green - Y
	);
	cylinderY.position.set(0, axisLength/2, 0);

	const cylinderZ = new THREE.Mesh(
		new THREE.CylinderGeometry(size, size, axisLength, 10),
		new THREE.MeshBasicMaterial({color: 0x0000FF}) // Blue - Z
	);
	cylinderZ.position.set(0, 0, axisLength/2);
	cylinderZ.rotation.set(Math.PI / 2, 0, 0);

	// Arrow tips
	const coneX = new THREE.Mesh(
		new THREE.ConeGeometry(coneSize, coneLen, 8, 1),
		new THREE.MeshBasicMaterial({color: 0xFF0000})
	);
	coneX.position.set(conePosition, 0, 0);
	coneX.rotation.set(0, 0, -Math.PI / 2);

	const coneY = new THREE.Mesh(
		new THREE.ConeGeometry(coneSize, coneLen, 8, 1),
		new THREE.MeshBasicMaterial({color: 0x79FF00})
	);
	coneY.position.set(0, conePosition, 0);

	const coneZ = new THREE.Mesh(
		new THREE.ConeGeometry(coneSize, coneLen, 8, 1),
		new THREE.MeshBasicMaterial({color: 0x0000FF})
	);
	coneZ.position.set(0, 0, conePosition);
	coneZ.rotation.set(Math.PI / 2, 0, 0);

	// Axis labels
	const spriteX = spriteText("x", "#FF0000", [labelPosition, 0, 0]);
	const spriteY = spriteText("y", "#79FF00", [0, labelPosition+3*size, 0]);
	const spriteZ = spriteText("z", "#0000FF", [0, 0, labelPosition]);

	// Add to the output group
	group.add(cylinderX, cylinderY, cylinderZ,
			  coneX, coneY, coneZ,
			  spriteX, spriteY, spriteZ);
};
