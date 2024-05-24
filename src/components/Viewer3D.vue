<script setup lang="ts">
/**
 * @component
 * Viewer 3D component.
 */

import {onMounted, ref, watch, watchEffect, nextTick} from "vue";
import * as THREE from "three";
import CameraControls from "camera-controls";
import {useConfigStore} from "@/stores/configStore";
import {useControlStore} from "@/stores/controlStore";
import {useMessageStore} from "@/stores/messageStore";
// import {ViewHelper} from "three/examples/jsm/helpers/ViewHelper.js";
import {sm} from "@/services/SceneManager";
import {saveDataURL, saveMovie, saveSTL} from "@/services/RoutesClient";
import {fitPerspectiveCameraToObject, fitOrthographicCameraToObject} from "@/services/FitCamera";
import type {MainResponse} from "@/types";
import {showErrorNotification} from "@/services/ErrorNotification";
import {setupSceneHelpers} from "@/services/SceneHelpers";

// > Access the stores
const configStore = useConfigStore();
const controlStore = useControlStore();
const messageStore = useMessageStore();

// > Properties
const props = defineProps<{

    /** True if the viewer part is expanded */
    expanded: boolean;
}>();

/**
 * Copy the position of the perspective camera to the orthographic camera
 *
 * @param perspectiveCamera - The perspective camera, the source of the copy
 * @param orthographicCamera - The orthographic camera, the receiver of the copy
 */
const copyPerspectiveCamera = (perspectiveCamera: THREE.PerspectiveCamera,
                               orthographicCamera: THREE.OrthographicCamera): void => {

    const vFov = (perspectiveCamera.fov * Math.PI) / 180;
    const distance = perspectiveCamera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    const halfHeight = Math.tan(vFov / 2) * distance;
    const halfWidth = halfHeight * perspectiveCamera.aspect;
    orthographicCamera.top = halfHeight;
    orthographicCamera.bottom = -halfHeight;
    orthographicCamera.left = -halfWidth;
    orthographicCamera.right = halfWidth;
    orthographicCamera.zoom = 1;
    orthographicCamera.lookAt(new THREE.Vector3(0, 0, 0));
    orthographicCamera.near = 0.1;
    orthographicCamera.far = 5000;

    orthographicCamera.position.copy(perspectiveCamera.position);
};

/**
 * Set the orthographic camera aspect ratio from the perspective camera
 *
 * @param perspectiveCamera - The perspective camera, the source of the computation
 * @param orthographicCamera - The orthographic camera that receives the result
 * @param aspect - The aspect ratio of the perspective camera
 */
const setOrthographicAspect = (perspectiveCamera: THREE.PerspectiveCamera,
                               orthographicCamera: THREE.OrthographicCamera, aspect: number): void => {

    const vFov = (perspectiveCamera.fov * Math.PI) / 180;
    const distance = perspectiveCamera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    const halfHeight = Math.tan(vFov / 2) * distance;
    const halfWidth = halfHeight * aspect;
    orthographicCamera.top = halfHeight;
    orthographicCamera.bottom = -halfHeight;
    orthographicCamera.left = -halfWidth;
    orthographicCamera.right = halfWidth;
};

// > Movie and screenshot support
// All recorded chunks captured
const recordedChunks: Blob[] = [];

/**
 * Save data chunk from MediaRecorder
 *
 * @param event - Data from MediaRecorder
 */
const handleDataAvailable = (event: BlobEvent): void => {recordedChunks.push(event.data);};

/**
 * Saves the video file on stop recording
 */
async function handleStop(): Promise<void> {

    const blob = new Blob(recordedChunks, {
        type: "video/webm; codecs=vp9"
    });

    const buffer = await blob.arrayBuffer();
    const sts = await saveMovie(buffer);
    if(sts.error) {
        messageStore.captureMedia.typeM = "error";
        messageStore.captureMedia.textM = sts.error;
    }
    else if(sts.payload) {
        messageStore.captureMedia.typeM = "success";
        messageStore.captureMedia.textM = sts.payload;
    }
}

/**
 * Handle MediaRecording errors
 *
 * @param event - Error event
 */
const handleError = (event: Event): void => {
    messageStore.captureMedia.typeM = "error";
    messageStore.captureMedia.textM = (event as unknown as {error: {name: string}}).error.name;
};

// Reference to the view
const cnv = ref<HTMLElement | null>(null);

// Create the scene
const scene = sm.createScene();

// > When the canvas is defined, mount the viewer
onMounted(() => {

    if(!cnv.value) {
        showErrorNotification("Cannot create canvas. Quitting.");
        return;
    }

    // Create cameras
    const cameraPerspective = new THREE.PerspectiveCamera(75,
                                                          cnv.value.clientWidth / cnv.value.clientHeight,
                                                          0.1, 2000);
    cameraPerspective.position.set(...configStore.camera.position);
    cameraPerspective.lookAt(new THREE.Vector3(...configStore.camera.lookAt));

    const cameraOrthographic = new THREE.OrthographicCamera();
    copyPerspectiveCamera(cameraPerspective, cameraOrthographic);

    let camera = configStore.camera.type === "perspective" ? cameraPerspective : cameraOrthographic;

    // Add renderer
    const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
    renderer.setSize(cnv.value.clientWidth, cnv.value.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    cnv.value.append(renderer.domElement);

    // Add mouse controls to move the camera
    CameraControls.install({THREE});
    const controls = new CameraControls(camera, renderer.domElement);

    // Add keyboard controls to camera positioning
    // const body = document.querySelector("body");
    window.addEventListener("keydown", (event: KeyboardEvent): void => {
        // if(event.target !== body) return;

        switch(event.code) {
            case "ArrowLeft":
                if(event.ctrlKey) void controls.rotate(THREE.MathUtils.DEG2RAD, 0, true);
                else if(event.altKey) void controls.forward(-0.1, false);
                else if(event.shiftKey) void controls.zoom(-0.05, false);
                else void controls.truck(.1, 0, false);
                break;
            case "ArrowRight":
                if(event.ctrlKey) void controls.rotate(-THREE.MathUtils.DEG2RAD, 0, true);
                else if(event.altKey) void controls.forward(0.1, false);
                else if(event.shiftKey) void controls.zoom(0.05, false);
                else void controls.truck(-.1, 0, false);
                break;
            case "ArrowUp":
                if(event.ctrlKey) void controls.rotate(0, THREE.MathUtils.DEG2RAD, true);
                else if(event.altKey) void controls.forward(0.1, false);
                else if(event.shiftKey) void controls.zoom(0.05, false);
                else void controls.truck(0, .1, false);
                break;
            case "ArrowDown":
                if(event.ctrlKey) void controls.rotate(0, -THREE.MathUtils.DEG2RAD, true);
                else if(event.altKey) void controls.forward(-0.1, false);
                else if(event.shiftKey) void controls.zoom(-0.05, false);
                else void controls.truck(0, -.1, false);
                break;
        }
    });
    // controls.addEventListener("controlend", () => {
    //     configStore.camera.position = [camera.position.x, camera.position.y, camera.position.z];
    //             console.log("POSITION*:",
    //                 cameraOrthographic.position.x,
    //                 cameraOrthographic.position.y,
    //                 cameraOrthographic.position.z);
    // });
    controls.addEventListener("sleep", () => {
        configStore.camera.position = [camera.position.x, camera.position.y, camera.position.z];
    });

    // Pick atoms by Ctrl+MouseLeft
    renderer.domElement.addEventListener("mousedown", (event: MouseEvent): void => {

        // if(!event.ctrlKey || !event.shiftKey) return;
        if(!event.ctrlKey) return;
        event.preventDefault();

        const mouse2D = new THREE.Vector2((event.offsetX / cnv.value!.clientWidth) * 2 - 1,
                                          -(event.offsetY / cnv.value!.clientHeight) * 2 + 1);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse2D, camera);

        const objects: THREE.Object3D[] = [];
        scene.traverse((object) => {
            if(object.name === "Atom") objects.push(object);
        });
        const intersects = raycaster.intersectObjects(objects);

        if(intersects.length > 0) {
            controlStore.addSelectedAtom(intersects[0].object.userData.index as number);
        }
        else {
            controlStore.deselectAtoms();
        }
    });

    // Switch cameras
    watchEffect(() => {

        if(configStore.camera.type === "perspective") {

            const oldY = cameraPerspective.position.y;
            cameraPerspective.position.copy(cameraOrthographic.position);
            cameraPerspective.position.y = oldY / cameraOrthographic.zoom;
            camera = cameraPerspective;
        }
        else {

            copyPerspectiveCamera(cameraPerspective, cameraOrthographic);

            camera = cameraOrthographic;
        }
        camera.updateProjectionMatrix();
        controls.camera = camera;
    });

    // Reset camera on request or when the scene objects change
    watchEffect(() => {

        if(controlStore.reset) {

            controlStore.reset = false;

            if(configStore.camera.type === "perspective") {

                fitPerspectiveCameraToObject(cameraPerspective, controls);
                copyPerspectiveCamera(cameraPerspective, cameraOrthographic);
                cameraOrthographic.updateProjectionMatrix();
            }
            else {
                fitOrthographicCameraToObject(cameraOrthographic, controls);
            }
        }
    });

    // Take snapshot
    watchEffect(() => {
        if(controlStore.snapshot) {

            controlStore.snapshot = false;

            const mimeType = `image/${configStore.camera.snapshotFormat}`;
            saveDataURL(renderer.domElement.toDataURL(mimeType))
                .then((response: MainResponse) => {
                    if(response.error) throw Error(response.error);
                    if(response.payload === "") return;
                    messageStore.captureMedia.typeS = "success";
                    messageStore.captureMedia.textS = response.payload;
                })
                .catch((error: Error) => {
                    messageStore.captureMedia.typeS = "error";
                    messageStore.captureMedia.textS = `Error saving snapshot. Error: ${error.message}`;
                });
        }
    });

    // Export geometry as STL file
    watchEffect(() => {

        if(controlStore.stl) {

            controlStore.stl = false;

            const result = sm.createSTL(configStore.camera.stlFormat);
            saveSTL(result, configStore.camera.stlFormat === "binary")
                .then((response: MainResponse) => {
                    if(response.error) throw Error(response.error);
                    if(response.payload === "") return;
                    messageStore.captureMedia.typeT = "success";
                    messageStore.captureMedia.textT = response.payload;
                })
                .catch((error: Error) => {
                    messageStore.captureMedia.typeT = "error";
                    messageStore.captureMedia.textT = `Error saving STL file. Error: ${error.message}`;
                });
        }
    });

    // Record movie
    let movieCaptureRunning = false;
    let mediaRecorder: MediaRecorder;
    let stream: MediaStream;
    watchEffect(() => {
        if(controlStore.movie) {

            movieCaptureRunning = true;

            // Capturing movie at 25 fps
            stream = renderer.domElement.captureStream(25);

            // Create the Media Recorder
            const options = {mimeType: "video/webm; codecs=vp9"};
            mediaRecorder = new MediaRecorder(stream, options);

            // Register event handlers and start recording
            mediaRecorder.ondataavailable = handleDataAvailable;
            mediaRecorder.onstop = handleStop;
            // eslint-disable-next-line unicorn/prefer-add-event-listener
            mediaRecorder.onerror = handleError;
            mediaRecorder.start();
        }
        else if(movieCaptureRunning) {
            movieCaptureRunning = false;
            mediaRecorder.stop();
            const tracks = stream.getTracks();
            for(const track of tracks) track.stop();
        }
    });

    // Scene helpers
    setupSceneHelpers();

    // Create lights
    sm.createLights();

    // const helper = new THREE.CameraHelper( camera );
    // scene.add( helper );
    // const viewHelper = new ViewHelper(camera, renderer.domElement);

    // Change the camera parameters when the window changes or ask for an expanded view
    const resizeScene = (): void => {

        void nextTick().then(() => {

            const aspect = cnv.value!.clientWidth / cnv.value!.clientHeight;

            if(configStore.camera.type === "perspective") {
                cameraPerspective.aspect = aspect;
            }
            else {
                setOrthographicAspect(cameraPerspective, cameraOrthographic, aspect);
            }
            camera.updateProjectionMatrix();

            renderer.setSize(cnv.value!.clientWidth, cnv.value!.clientHeight);
        });
    };

    window.addEventListener("resize", resizeScene);

    watch(props, resizeScene);

    // Start run
    const clock = new THREE.Clock();
    const animate = (): void => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
        // viewHelper.render(renderer);
        controls.update(clock.getDelta());
    };
    animate();
});

</script>


<template>
<div ref="cnv" class="canvas" />
</template>


<style scoped>

.canvas {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  flex-grow: 1;
}
</style>
