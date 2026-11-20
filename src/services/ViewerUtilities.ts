/**
 * Utilities used from various viewers
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-11-20
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
