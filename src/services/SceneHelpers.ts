/**
 * Show helper objects: axis and axis aligned grids.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import {Group, GridHelper, Mesh, CylinderGeometry,
		ConeGeometry, MeshStandardMaterial, DoubleSide} from "three";
import {watchEffect, watch, onUnmounted} from "vue";
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
	const stopWatcher1 = watch(helpers, () => {
		sm.modified();
	}, {deep: true});

	const stopWatcher2 = watchEffect(() => {

		// Manage axis helper
		let axis = sm.getObjectByName("AxisHelper") as Group | undefined;
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
				axis = new Group();
				axis.name = "AxisHelper";
				sm.add(axis);
				axis.visible = true;
				axisHelper(axis, configStore.helpers.axisLength);
				axisLengthPrevious = configStore.helpers.axisLength;
			}
		}
		else if(axis) axis.visible = false;

		// Manage XZ helper plane
		let gridXZ = sm.getObjectByName("GridHelperXZ") as GridHelper | undefined;
		if(configStore.helpers.showGridXZ) {
			if(gridXZ) {
				gridXZ.visible = true;
				if(configStore.helpers.gridSize !== sidePrevious) {
					sm.remove(gridXZ);
					gridXZ.dispose();
					gridXZ = gridHelper("XZ", configStore.helpers.gridSize);
					gridXZ.visible = true;
					sm.add(gridXZ);
					sidePrevious = configStore.helpers.gridSize;
				}
			}
			else {
				gridXZ = gridHelper("XZ", configStore.helpers.gridSize);
				gridXZ.visible = true;
				sm.add(gridXZ);
				sidePrevious = configStore.helpers.gridSize;
			}
		}
		else if(gridXZ) gridXZ.visible = false;

		// Manage XY helper plane
		let gridXY = sm.getObjectByName("GridHelperXY") as GridHelper | undefined;
		if(configStore.helpers.showGridXY) {
			if(gridXY) {
				gridXY.visible = true;
				if(configStore.helpers.gridSize !== sidePrevious) {
					sm.remove(gridXY);
					gridXY.dispose();
					gridXY = gridHelper("XY", configStore.helpers.gridSize);
					gridXY.visible = true;
					sm.add(gridXY);
					sidePrevious = configStore.helpers.gridSize;
				}
			}
			else {
				gridXY = gridHelper("XY", configStore.helpers.gridSize);
				gridXY.visible = true;
				sm.add(gridXY);
				sidePrevious = configStore.helpers.gridSize;
			}
		}
		else if(gridXY) gridXY.visible = false;

		// Manage YZ helper plane
		let gridYZ = sm.getObjectByName("GridHelperYZ") as GridHelper | undefined;
		if(configStore.helpers.showGridYZ) {
			if(gridYZ) {
				gridYZ.visible = true;
				if(configStore.helpers.gridSize !== sidePrevious) {
					sm.remove(gridYZ);
					gridYZ.dispose();
					gridYZ = gridHelper("YZ", configStore.helpers.gridSize);
					gridYZ.visible = true;
					sm.add(gridYZ);
					sidePrevious = configStore.helpers.gridSize;
				}
			}
			else {
				gridYZ = gridHelper("YZ", configStore.helpers.gridSize);
				gridYZ.visible = true;
				sm.add(gridYZ);
				sidePrevious = configStore.helpers.gridSize;
			}
		}
		else if(gridYZ) gridYZ.visible = false;
	});

	// Cleanup
	onUnmounted(() => {
		stopWatcher1();
		stopWatcher2();
	});
};

/**
 * Create the grid
 *
 * @returns The grid to be added to the scene
 */
const gridHelper = (plane: "XZ" | "XY" | "YZ", gridSide: number): GridHelper => {

	const grid = new GridHelper(gridSide, gridSide, "#FF0000");
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
const axisHelper = (group: Group, axisLength: number): void => {

	const size = 0.05;
	const coneSize = 2*size;
	const coneLen = 5*size;
	const conePosition = axisLength+size;
	const labelPosition = axisLength+coneLen;

	// Materials for the three axis
	const materialRed = new MeshStandardMaterial({
		color: 0xFF0000, // Red - X
		roughness: 0.5,
		metalness: 0.6,
		side: DoubleSide
	});
	const materialGreen = new MeshStandardMaterial({
		color: 0x79FF00, // Green - Y
		roughness: 0.5,
		metalness: 0.6,
		side: DoubleSide
	});
	const materialBlue = new MeshStandardMaterial({
		color: 0x0000FF, // Blue - Z
		roughness: 0.5,
		metalness: 0.6,
		side: DoubleSide
	});

	// Axis
	const cylinderX = new Mesh(new CylinderGeometry(size, size, axisLength, 10), materialRed);
	cylinderX.position.set(axisLength/2, 0, 0);
	cylinderX.rotation.set(0, 0, Math.PI / 2);

	const cylinderY = new Mesh(new CylinderGeometry(size, size, axisLength, 10), materialGreen);
	cylinderY.position.set(0, axisLength/2, 0);

	const cylinderZ = new Mesh(new CylinderGeometry(size, size, axisLength, 10), materialBlue);
	cylinderZ.position.set(0, 0, axisLength/2);
	cylinderZ.rotation.set(Math.PI / 2, 0, 0);

	// Arrow tips
	const coneX = new Mesh(new ConeGeometry(coneSize, coneLen, 10, 1), materialRed);
	coneX.position.set(conePosition, 0, 0);
	coneX.rotation.set(0, 0, -Math.PI / 2);

	const coneY = new Mesh(new ConeGeometry(coneSize, coneLen, 10, 1), materialGreen);
	coneY.position.set(0, conePosition, 0);

	const coneZ = new Mesh(new ConeGeometry(coneSize, coneLen, 10, 1), materialBlue);
	coneZ.position.set(0, 0, conePosition);
	coneZ.rotation.set(Math.PI / 2, 0, 0);

	// Correlate label size to axis length for legibility
	const labelSize = 0.4 + 0.6*(axisLength-0.5)/19.5;

	// Axis labels
	const spriteX = spriteText("x", "#FF0000", labelSize, [labelPosition, 0, 0]);
	const spriteY = spriteText("y", "#79FF00", labelSize, [0, labelPosition+3*size, 0]);
	const spriteZ = spriteText("z", "#0000FF", labelSize, [0, 0, labelPosition]);

	// Add to the output group
	group.add(cylinderX, cylinderY, cylinderZ,
			  coneX, coneY, coneZ,
			  spriteX, spriteY, spriteZ);
	sm.modified();
};
