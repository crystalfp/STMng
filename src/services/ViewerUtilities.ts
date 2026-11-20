/**
 * Utilities used from various viewers
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-11-20
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import type {Scene, Mesh} from "three";

/**
 * Empty a group with the given name
 *
 * @param scene - Scene where to apply the finction
 * @param groupName - Name of the group to be cleared
 * @param removeGroup - If true remove also the group itself from the scene
 */
export const clearGroupCore = (scene: Scene, groupName: string, removeGroup=false): void => {

	const group = scene.getObjectByName(groupName);
	if(!group) return;

	// Meshes to be delete from the group
	const meshes: Mesh[] = [];

	// Remove meshes' parts
	group.traverse((object) => {

		if(object.type === "Group") return;

		const mesh = object as Mesh;
		if(mesh.geometry) mesh.geometry.dispose();
		if(mesh.material) {
			if(Array.isArray(mesh.material)) {
				for(const material of mesh.material) material.dispose();
			}
			else {
				mesh.material.dispose();
			}
		}
		meshes.push(mesh);
	});

	// Clear the group
	for(const mesh of meshes) {group.remove(mesh);}
	group.clear();

	// Remove the group itself
	if(removeGroup) scene.remove(group);
};
