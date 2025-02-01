<script setup lang="ts">
/**
 * @component
 * Viewer 3D component.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {onMounted, watch, watchEffect, nextTick, useTemplateRef} from "vue";
import {PerspectiveCamera, OrthographicCamera, Vector3, Vector2, WebGLRenderer,
        Raycaster, type Object3D, type Mesh, type MeshLambertMaterial, Clock,
        Vector4, Quaternion, Matrix4, Spherical, Box3, Sphere, MathUtils} from "three";
import CameraControls from "camera-controls";
import {ViewportGizmo, type GizmoOptions} from "three-viewport-gizmo";
import {useConfigStore} from "@/stores/configStore";
import {useControlStore} from "@/stores/controlStore";
import {useMessageStore} from "@/stores/messageStore";
import {sm} from "@/services/SceneManager";
import {askNode} from "@/services/RoutesClient";
import {fitPerspectiveCameraToObject, fitOrthographicCameraToObject} from "@/services/FitCamera";
import {setupSceneHelpers} from "@/services/SceneHelpers";
import {showAlertMessage} from "@/services/AlertMessage";
import type {CtrlParams} from "@/types";

/** Convert degrees to radiants */
const DEG2RAD = Math.PI/180;

// > Access the stores
const configStore  = useConfigStore();
const controlStore = useControlStore();
const messageStore = useMessageStore();

// > Properties
const props = defineProps<{

    /** True if the viewer fills the whole window */
    expanded: boolean;
}>();

/**
 * Copy the position of the perspective camera to the orthographic camera
 *
 * @param perspectiveCamera - The perspective camera, the source of the copy
 * @param orthographicCamera - The orthographic camera, the receiver of the copy
 */
const copyPerspectiveCamera = (perspectiveCamera: PerspectiveCamera,
                               orthographicCamera: OrthographicCamera): void => {


    setOrthographicAspect(perspectiveCamera, orthographicCamera, perspectiveCamera.aspect);

    orthographicCamera.zoom = 1;
    orthographicCamera.lookAt(new Vector3(0, 0, 0));
    orthographicCamera.near = 0.1;
    orthographicCamera.far = 500;

    orthographicCamera.position.copy(perspectiveCamera.position);
};

/**
 * Set the orthographic camera aspect ratio from the perspective camera
 *
 * @param perspectiveCamera - The perspective camera, the source of the computation
 * @param orthographicCamera - The orthographic camera that receives the result
 * @param aspect - The aspect ratio of the perspective camera
 */
const setOrthographicAspect = (perspectiveCamera: PerspectiveCamera,
                               orthographicCamera: OrthographicCamera, aspect: number): void => {

    const vFov = perspectiveCamera.fov * DEG2RAD;
    const distance = perspectiveCamera.position.distanceTo(new Vector3(0, 0, 0));
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

    askNode("SYSTEM", "movie", {buffer, width: cnv.value!.clientWidth, height: cnv.value!.clientHeight})
        .then((sts) => {
            if(sts.error) throw Error(sts.error as string);
            if(sts.payload) {
                messageStore.captureMedia.typeM = "success";
                messageStore.captureMedia.textM = sts.payload as string;
            }
        })
        .catch((error: Error) => {
            messageStore.captureMedia.typeM = "error";
            messageStore.captureMedia.textM = error.message;
        });
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
const cnv = useTemplateRef<HTMLElement>("cnv");

// Create the scene
const scene = sm.createScene();

// > When the canvas is defined, mount the viewer
onMounted(() => {

    if(!cnv.value) {
        showAlertMessage("Cannot create canvas. Quitting.");
        return;
    }

    // Create cameras
    const cameraPerspective = new PerspectiveCamera(75,
                                                    cnv.value.clientWidth / cnv.value.clientHeight,
                                                    0.1, 500);
    cameraPerspective.position.set(...configStore.camera.position);
    cameraPerspective.lookAt(new Vector3(...configStore.camera.lookAt));

    const cameraOrthographic = new OrthographicCamera();
    copyPerspectiveCamera(cameraPerspective, cameraOrthographic);

    let camera = configStore.camera.type === "perspective" ? cameraPerspective : cameraOrthographic;

    // Add renderer
    const renderer = new WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(cnv.value.clientWidth, cnv.value.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    cnv.value.append(renderer.domElement);

    // Add mouse controls to move the camera
    const subsetOfTHREE = {PerspectiveCamera, OrthographicCamera, Vector3, Vector2, WebGLRenderer,
                           Raycaster, Clock, Vector4, Quaternion, Matrix4, Spherical, Box3,
                           Sphere, MathUtils};
    CameraControls.install({THREE: subsetOfTHREE});
    const controls = new CameraControls(camera, renderer.domElement);

    // Add keyboard controls to camera positioning
    globalThis.addEventListener("keydown", (event: KeyboardEvent): void => {

        switch(event.code) {
            case "ArrowLeft":
                if(event.ctrlKey) void controls.rotate(DEG2RAD, 0, true);
                else if(event.altKey) void controls.forward(-0.1, false);
                else if(event.shiftKey) void controls.zoom(-0.05, false);
                else void controls.truck(.1, 0, false);
                break;
            case "ArrowRight":
                if(event.ctrlKey) void controls.rotate(-DEG2RAD, 0, true);
                else if(event.altKey) void controls.forward(0.1, false);
                else if(event.shiftKey) void controls.zoom(0.05, false);
                else void controls.truck(-.1, 0, false);
                break;
            case "ArrowUp":
                if(event.ctrlKey) void controls.rotate(0, DEG2RAD, true);
                else if(event.altKey) void controls.forward(0.1, false);
                else if(event.shiftKey) void controls.zoom(0.05, false);
                else void controls.truck(0, .1, false);
                break;
            case "ArrowDown":
                if(event.ctrlKey) void controls.rotate(0, -DEG2RAD, true);
                else if(event.altKey) void controls.forward(-0.1, false);
                else if(event.shiftKey) void controls.zoom(-0.05, false);
                else void controls.truck(0, -.1, false);
                break;
        }
    });

    controls.addEventListener("sleep", () => {
        configStore.camera.position = [camera.position.x, camera.position.y, camera.position.z];
    });

    // Pick atoms by Ctrl+MouseLeft
    renderer.domElement.addEventListener("mousedown", (event: MouseEvent): void => {

        if(!event.ctrlKey) return;
        event.preventDefault();

        const mouse2D = new Vector2((event.offsetX / cnv.value!.clientWidth) * 2 - 1,
                                          -(event.offsetY / cnv.value!.clientHeight) * 2 + 1);
        const raycaster = new Raycaster();
        raycaster.setFromCamera(mouse2D, camera);

        const objects: Object3D[] = [];
        scene.traverse((object: Object3D) => {
            if(object.name === "Atom" || object.name === "Polyhedron") objects.push(object);
        });
        const intersects = raycaster.intersectObjects(objects);

        if(intersects.length > 0 && intersects[0]) {

            const {object} = intersects[0];
            if(object.name === "Atom") {
                controlStore.addSelectedAtom(object.userData.index as number);
            }
            else if(object.name === "Polyhedron") {
                controlStore.deselectPolyhedron();
                const color = ((object as Mesh).material as
                                MeshLambertMaterial).color.getHex();
                controlStore.selectPolyhedron(object.userData.idx as number, color);
            }
        }
        else {
            controlStore.deselectAll();
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
        sm.modified();
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
            sm.modified();
        }
    });

    // Force camera position if requested
    watchEffect(() => {

        if(controlStore.force) {

            controlStore.force = false;

	        void controls.setLookAt(configStore.camera.position[0],
                                    configStore.camera.position[1],
                                    configStore.camera.position[2],
							        configStore.camera.lookAt[0],
                                    configStore.camera.lookAt[1],
                                    configStore.camera.lookAt[2],
                                    false);
            if(configStore.camera.type === "perspective") {
                cameraPerspective.position.set(...configStore.camera.position);
                cameraPerspective.lookAt(new Vector3(...configStore.camera.lookAt));
                cameraPerspective.updateProjectionMatrix();
            }
            else {
                cameraOrthographic.position.set(...configStore.camera.position);
                cameraOrthographic.lookAt(new Vector3(...configStore.camera.lookAt));
                cameraOrthographic.updateProjectionMatrix();
            }
            sm.modified();
        }
    });

    // Take snapshot
    watchEffect(() => {

        if(controlStore.snapshot) {

            controlStore.snapshot = false;

            const mimeType = `image/${configStore.camera.snapshotFormat}`;
            askNode("SYSTEM", "snapshot", {dataURI: renderer.domElement.toDataURL(mimeType)})
                .then((response: CtrlParams) => {
                    if(response.error) throw Error(response.error as string);
                    if(response.payload === "") return;
                    messageStore.captureMedia.typeS = "success";
                    messageStore.captureMedia.textS = response.payload as string;
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
            askNode("SYSTEM", "stl", {binary: configStore.camera.stlFormat === "binary", content: result})
                .then((response: CtrlParams) => {
                    if(response.error) throw Error(response.error as string);
                    if(response.payload === "") return;
                    messageStore.captureMedia.typeT = "success";
                    messageStore.captureMedia.textT = response.payload as string;
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

    const gizmoOptions: GizmoOptions = {

        size: 150,
        placement: "bottom-right",
        lineWidth: 30,
        resolution: 128,
        background: {enabled: false},
        x: {color: "#FF0000", labelColor: "#000", label: "X"},
        y: {color: "#79FF00", labelColor: "#000", label: "Y"},
        z: {color: "#0000FF", labelColor: "#000", label: "Z"},
        nx: {enabled: false},
        ny: {enabled: false},
        nz: {enabled: false},
    };
    const viewportGizmo = new ViewportGizmo(camera, renderer, gizmoOptions);

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

            viewportGizmo.update();
        });
    };

    globalThis.addEventListener("resize", resizeScene);

    watch(props, resizeScene);

    // Set the events listeners
    viewportGizmo.addEventListener("start", () => (controls.enabled = false));
    viewportGizmo.addEventListener("end", () => (controls.enabled = true));
    viewportGizmo.addEventListener("change", () => {
        void controls.setPosition(...camera.position.toArray());
    });

    controls.addEventListener("update", () => {
        controls.getTarget(viewportGizmo.target);
        viewportGizmo.update();
    });

    // Set the target
    void controls.setTarget(...viewportGizmo.target.set(0, 3, 0).toArray());
    camera.lookAt(viewportGizmo.target);

    // Rendering function for the run
    const clock = new Clock();
    const animate = (): void => {
        const doRender = controls.update(clock.getDelta());
        if(doRender || sm.needRendering()) {
            renderer.render(scene, camera);
            if(configStore.helpers.showGizmo) viewportGizmo.render();
        }
    };

    // First time render everything
    controls.update(clock.getDelta());
    renderer.render(scene, camera);
    if(configStore.helpers.showGizmo) viewportGizmo.render();

    // Start run
    renderer.setAnimationLoop(animate);
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
