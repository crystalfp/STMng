/**
 * Move the camera to have all the scene bounding box visible.
 * @remarks It uses the bounding box stored in the configStore. Currently it covers a single structure.
 *
 * @packageDocumentation
 */
import * as THREE from "three";
import {useConfigStore} from "@/stores/configStore";
import type CameraControls from "camera-controls";

/**
 * Fit the camera to look at the whole scene
 *
 * @param camera - The perspective camera to be moved
 * @param controls - The orbit control to have the rotation center updated
 */
export const fitPerspectiveCameraToObject = (camera: THREE.PerspectiveCamera,
											 controls: CameraControls): void => {

	// Get bounding box of the scene - this will be used to setup controls and camera
	const configStore = useConfigStore();
	const {sceneCenter, sceneSides} = configStore.control;
	const center = new THREE.Vector3(sceneCenter[0], sceneCenter[1], sceneCenter[2]);

	// Get the max side of the bounding box (fits to width OR height as needed)
	const maxDim = Math.max(sceneSides[0], sceneSides[1]);
	const halfFov = (camera.fov * Math.PI) / 360;
	const cameraZ = (maxDim / Math.tan(halfFov) + sceneSides[2]) / 2 + sceneCenter[2];

	// Finish changing position and direction of the camera
	camera.position.x = sceneCenter[0];
	camera.position.y = sceneCenter[1];
	camera.position.z = cameraZ * 1.25; // Zoom out a little so that objects don't fill the screen
	camera.lookAt(center);

	// Set camera to rotate around center of loaded object
	controls.setOrbitPoint(center.x, center.y, center.z);
	void controls.zoomTo(1, true);
	camera.updateProjectionMatrix();

	// Update camera position and center
	configStore.camera.position = [camera.position.x, camera.position.y, camera.position.z];
	configStore.camera.lookAt = [center.x, center.y, center.z];
};

export const fitOrthographicCameraToObject = (camera: THREE.OrthographicCamera,
											  controls: CameraControls): void => {

	// Get bounding box of the scene - this will be used to setup controls and camera
	const configStore = useConfigStore();
	const {sceneCenter, sceneSides} = configStore.control;

    camera.lookAt(new THREE.Vector3(sceneCenter[0], sceneCenter[1], sceneCenter[2]));

	// Set camera to rotate around center of loaded object
	controls.setOrbitPoint(sceneCenter[0], sceneCenter[1], sceneCenter[2]);
	const maxSide = Math.max(sceneSides[0], sceneSides[1], sceneSides[2]);
	void controls.setLookAt(sceneCenter[0], sceneCenter[1], sceneCenter[2] + 2*maxSide,
							sceneCenter[0], sceneCenter[1], sceneCenter[2], false);
	void controls.zoomTo(1, true);
	camera.updateProjectionMatrix();

	// Update camera position and center
	configStore.camera.position = [camera.position.x, camera.position.y, camera.position.z];
	configStore.camera.lookAt = [sceneCenter[0], sceneCenter[1], sceneCenter[2]];
};
