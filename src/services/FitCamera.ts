/**
 * Move the camera to have all the scene bounding sphere visible.
 * @remarks Currently it covers a single structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {type PerspectiveCamera, OrthographicCamera, Vector3, Sphere} from "three";
import {useConfigStore} from "@/stores/configStore";
import {useControlStore} from "@/stores/controlStore";
import type CameraControls from "camera-controls";

/**
 * Fit the camera to look at the whole scene
 *
 * @param camera - The camera to be moved
 * @param controls - The orbit control to have the rotation center updated
 */
export const fitCamera = (camera: OrthographicCamera | PerspectiveCamera,
						  controls: CameraControls): void => {

	const margin = camera instanceof OrthographicCamera ? 1.1 : 0.9;

	// Get bounding sphere of the scene - this will be used to setup controls and camera
	const controlStore = useControlStore();
	const {sceneCenter, sceneRadius} = controlStore;

	const center = new Vector3(sceneCenter[0], sceneCenter[1], sceneCenter[2]);
	camera.lookAt(center);
	const position = camera.position.sub(center).normalize().multiplyScalar(sceneRadius*margin).add(center);
	camera.position.set(position.x, position.y, position.z);

	// Set camera to rotate around center of loaded object
	controls.setOrbitPoint(sceneCenter[0], sceneCenter[1], sceneCenter[2]);

	const sphere = new Sphere(center, sceneRadius);
	void controls.fitToSphere(sphere, false).then(() => {

		camera.updateProjectionMatrix();

		// Update camera position and center
		const configStore = useConfigStore();
		configStore.camera.position = [camera.position.x, camera.position.y, camera.position.z];
		configStore.camera.lookAt = [sceneCenter[0], sceneCenter[1], sceneCenter[2]];
	});
};
