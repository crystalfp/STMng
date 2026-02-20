<script setup lang="ts">
/**
 * @component
 * Viewer 3D component.
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
import {onMounted, watchEffect, useTemplateRef} from "vue";
import {PerspectiveCamera, OrthographicCamera, Vector3, Vector2, WebGLRenderer,
        Raycaster, type Object3D, type Mesh, type MeshLambertMaterial,
        Vector4, Quaternion, Matrix4, Spherical, Box3, Sphere,
        Timer, MathUtils} from "three";
import CameraControls from "camera-controls";
import {ViewportGizmo, type GizmoOptions} from "three-viewport-gizmo";
import {useConfigStore} from "@/stores/configStore";
import {useControlStore} from "@/stores/controlStore";
import {sm} from "@/services/SceneManager";
import {askNode, getAntialiasing} from "@/services/RoutesClient";
import {fitCamera} from "@/services/FitCamera";
import {setupSceneHelpers} from "@/services/SceneHelpers";
import {resetNodeAlert, showNodeAlert, showSystemAlert} from "@/services/AlertMessage";
import {CaptureMovie} from "@/services/CaptureMovie";
import type {CtrlParams} from "@/types";
import type {BillboardBatchedText} from "@/services/SpriteText";

import ViewerLegend from "@/widgets/ViewerLegend.vue";

// > Access the stores
const configStore  = useConfigStore();
const controlStore = useControlStore();

/**
 * Copy the position of the perspective camera to the orthographic camera
 *
 * @param perspectiveCamera - The perspective camera, the source of the copy
 * @param orthographicCamera - The orthographic camera, the receiver of the copy
 */
const copyPerspectiveCamera = (perspectiveCamera: PerspectiveCamera,
                               orthographicCamera: OrthographicCamera): void => {


    setOrthographicAspect(perspectiveCamera,
                          orthographicCamera,
                          perspectiveCamera.aspect);

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

    const vFov = perspectiveCamera.fov * MathUtils.DEG2RAD;
    const distance = perspectiveCamera.position.distanceTo(new Vector3(0, 0, 0));
    const halfHeight = Math.tan(vFov / 2) * distance;
    const halfWidth = halfHeight * aspect;
    orthographicCamera.top = halfHeight;
    orthographicCamera.bottom = -halfHeight;
    orthographicCamera.left = -halfWidth;
    orthographicCamera.right = halfWidth;
};

// Reference to the view
const cnv = useTemplateRef<HTMLElement>("cnv");

// Create the scene
const scene = sm.createScene();

// > When the canvas is defined, mount the viewer
onMounted(() => {

    if(!cnv.value) {
        showSystemAlert("Cannot create Viewer3D. Quitting.");
        return;
    }

    // Create cameras
    const cameraPerspective = new PerspectiveCamera(
        75,
        cnv.value.clientWidth / cnv.value.clientHeight,
        0.1,
        500
    );
    cameraPerspective.position.set(...configStore.camera.position);
    cameraPerspective.lookAt(new Vector3(...configStore.camera.lookAt));

    const cameraOrthographic = new OrthographicCamera();
    copyPerspectiveCamera(cameraPerspective, cameraOrthographic);

    let camera = configStore.camera.type === "perspective" ?
                                                    cameraPerspective :
                                                    cameraOrthographic;

    const antialias = getAntialiasing();

    // Add renderer
    const renderer = new WebGLRenderer({
        antialias,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
        alpha: true
    });
    // renderer.setSize(cnv.value.clientWidth, cnv.value.clientHeight);
    // Size will be set at the end of mounting
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    cnv.value.append(renderer.domElement);

    // Add mouse controls to move the camera
    const subsetOfTHREE = {PerspectiveCamera, OrthographicCamera, Vector3,
                           Vector2, WebGLRenderer, Raycaster, Vector4,
                           Quaternion, Matrix4, Spherical, Box3,
                           Sphere, MathUtils};
    CameraControls.install({THREE: subsetOfTHREE});
    const controls = new CameraControls(camera, renderer.domElement);

    // Add keyboard controls to camera positioning
    globalThis.addEventListener("keydown", (event: KeyboardEvent): void => {

        switch(event.code) {
            case "ArrowLeft":
                if(event.ctrlKey) void controls.rotate(MathUtils.DEG2RAD, 0, true);
                else if(event.altKey) void controls.forward(-0.1, false);
                else if(event.shiftKey) void controls.zoom(-0.05, false);
                else void controls.truck(0.1, 0, false);
                break;
            case "ArrowRight":
                if(event.ctrlKey) void controls.rotate(-MathUtils.DEG2RAD, 0, true);
                else if(event.altKey) void controls.forward(0.1, false);
                else if(event.shiftKey) void controls.zoom(0.05, false);
                else void controls.truck(-0.1, 0, false);
                break;
            case "ArrowUp":
                if(event.ctrlKey) void controls.rotate(0, MathUtils.DEG2RAD, true);
                else if(event.altKey) void controls.forward(0.1, false);
                else if(event.shiftKey) void controls.zoom(0.05, false);
                else void controls.truck(0, 0.1, false);
                break;
            case "ArrowDown":
                if(event.ctrlKey) void controls.rotate(0, -MathUtils.DEG2RAD, true);
                else if(event.altKey) void controls.forward(-0.1, false);
                else if(event.shiftKey) void controls.zoom(-0.05, false);
                else void controls.truck(0, -0.1, false);
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

                // Find the instance of the same mesh
                const instanceId = intersects[0].instanceId;
                if(instanceId !== undefined) {

                    controlStore.addSelection(object.userData.index as number, instanceId);
                }
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
        fitCamera(camera, controls);

        camera.updateProjectionMatrix();
        controls.camera = camera;
        sm.modified();
    });

    // Reset camera on request or when the scene objects change
    watchEffect(() => {

        if(controlStore.reset) {

            controlStore.reset = false;

            if(configStore.camera.type === "perspective") {

                fitCamera(cameraPerspective, controls);
                copyPerspectiveCamera(cameraPerspective, cameraOrthographic);
                cameraOrthographic.updateProjectionMatrix();
            }
            else {
                fitCamera(cameraOrthographic, controls);
            }

            // Set the viewer aspect ratio
            const rect = cnv.value!.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;

            setOnResize(w, h);

            sm.modified();
        }
    });

    // Move camera to look along an axis or along a crystal basis
    watchEffect(() => {

        const vd = controlStore.viewDirection;
        if(vd === "") return;
        const sign = vd[0];
        const axis = vd[1];

        const dx = configStore.camera.position[0]-configStore.camera.lookAt[0];
        const dy = configStore.camera.position[1]-configStore.camera.lookAt[1];
        const dz = configStore.camera.position[2]-configStore.camera.lookAt[2];
        const distance = Math.hypot(dx, dy, dz);

        switch(axis) {
        case "x":
            configStore.camera.position[0] = sign === "+" ?
                                                    configStore.camera.lookAt[0] - distance :
                                                    configStore.camera.lookAt[0] + distance;
            configStore.camera.position[1] = configStore.camera.lookAt[1];
            configStore.camera.position[2] = configStore.camera.lookAt[2];
            break;
        case "y":
            configStore.camera.position[0] = configStore.camera.lookAt[0];
            configStore.camera.position[1] = sign === "+" ?
                                                    configStore.camera.lookAt[1] - distance :
                                                    configStore.camera.lookAt[1] + distance;
            configStore.camera.position[2] = configStore.camera.lookAt[2];
            break;
        case "z":
            configStore.camera.position[0] = configStore.camera.lookAt[0];
            configStore.camera.position[1] = configStore.camera.lookAt[1];
            configStore.camera.position[2] = sign === "+" ?
                                                    configStore.camera.lookAt[2] - distance :
                                                    configStore.camera.lookAt[2] + distance;
            break;
        case "a": {
            const len = Math.hypot(controlStore.basis[0],
                                   controlStore.basis[1],
                                   controlStore.basis[2]);
            const m = (sign === "+" ? -distance : distance)/len;
            configStore.camera.position[0] = configStore.camera.lookAt[0] + controlStore.basis[0]*m;
            configStore.camera.position[1] = configStore.camera.lookAt[1] + controlStore.basis[1]*m;
            configStore.camera.position[2] = configStore.camera.lookAt[2] + controlStore.basis[2]*m;
            }
            break;
        case "b": {
            const len = Math.hypot(controlStore.basis[3],
                                   controlStore.basis[4],
                                   controlStore.basis[5]);
            const m = (sign === "+" ? -distance : distance)/len;
            configStore.camera.position[0] = configStore.camera.lookAt[0] + controlStore.basis[3]*m;
            configStore.camera.position[1] = configStore.camera.lookAt[1] + controlStore.basis[4]*m;
            configStore.camera.position[2] = configStore.camera.lookAt[2] + controlStore.basis[5]*m;
            }
            break;
        case "c": {
            const len = Math.hypot(controlStore.basis[6],
                                   controlStore.basis[7],
                                   controlStore.basis[8]);
            const m = (sign === "+" ? -distance : distance)/len;
            configStore.camera.position[0] = configStore.camera.lookAt[0] + controlStore.basis[6]*m;
            configStore.camera.position[1] = configStore.camera.lookAt[1] + controlStore.basis[7]*m;
            configStore.camera.position[2] = configStore.camera.lookAt[2] + controlStore.basis[8]*m;
            }
            break;
        default:
            return;
        }
        void controls.normalizeRotations().setLookAt(
                configStore.camera.position[0],
                configStore.camera.position[1],
                configStore.camera.position[2],
                configStore.camera.lookAt[0],
                configStore.camera.lookAt[1],
                configStore.camera.lookAt[2],
                true
            );
        sm.modified();
        controlStore.viewDirection = "";
    });

    // Force camera position if requested
    watchEffect(() => {

        if(controlStore.force) {

            controlStore.force = false;

	        void controls.normalizeRotations().setLookAt(
                configStore.camera.position[0],
                configStore.camera.position[1],
                configStore.camera.position[2],
                configStore.camera.lookAt[0],
                configStore.camera.lookAt[1],
                configStore.camera.lookAt[2],
                true
            );
            sm.modified();
        }
    });

    // Depth cueing
    watchEffect(() => {

        if(configStore.scene.depthNear > configStore.scene.depthFar) {
            const near = configStore.scene.depthNear;
            configStore.scene.depthNear = configStore.scene.depthFar;
            configStore.scene.depthFar = near;
        }

        sm.setDepthCueing(
            configStore.scene.depthCueing,
            configStore.scene.depthNear,
            configStore.scene.depthFar,
        );
    });

    // Take snapshot
    watchEffect(() => {

        if(controlStore.snapshot) {

            controlStore.snapshot = false;
            resetNodeAlert();

            let mimeTypeFormat = configStore.camera.snapshotFormat;
            const channel = mimeTypeFormat === "pdf" ? "snapshotPDF" : "snapshot";
            if(mimeTypeFormat === "pdf") mimeTypeFormat = "jpeg";
            const mimeType = `image/${mimeTypeFormat}`;

            // If requested png with transparent background
            if(configStore.camera.snapshotTransparent && mimeTypeFormat === "png") {
                sm.transparentSceneBackground(true);
                setTimeout(() => {
                    askNode("SYSTEM", channel, {
                        dataURI: renderer.domElement.toDataURL(mimeType),
                        format: configStore.camera.snapshotFormat
                    })
                    .then((response: CtrlParams) => {
                        if(response.error) throw Error(response.error as string);
                        if(response.payload === "") return;
                        showNodeAlert(response.payload as string, "captureSnapshot",
                                      {level: "success"});
                    })
                    .catch((error: Error) => {
                        showNodeAlert(`Error saving snapshot. Error: ${error.message}`,
                                      "captureSnapshot");
                    })
                    .finally(() => {
                        if(configStore.camera.snapshotTransparent) sm.transparentSceneBackground(false);
                    });
                }, 200);
                return;
            }

            // For snapshots without transparent background
            askNode("SYSTEM", channel, {
                dataURI: renderer.domElement.toDataURL(mimeType),
                format: configStore.camera.snapshotFormat
            })
            .then((response: CtrlParams) => {
                if(response.error) throw Error(response.error as string);
                if(response.payload === "") return;
                showNodeAlert(response.payload as string, "captureSnapshot",
                              {level: "success"});
            })
            .catch((error: Error) => {
                showNodeAlert(`Error saving snapshot. Error: ${error.message}`,
                              "captureSnapshot");
            });
        }
    });

    // Export geometry as STL file
    watchEffect(() => {

        if(controlStore.stl) {

            controlStore.stl = false;
            resetNodeAlert();

            const result = sm.createSTL(configStore.camera.stlFormat);
            askNode("SYSTEM", "stl", {
                binary: configStore.camera.stlFormat === "binary",
                content: result
            })
            .then((response: CtrlParams) => {
                if(response.error) throw Error(response.error as string);
                if(response.payload === "") return;
                showNodeAlert(response.payload as string, "captureSTL", {level: "success"});
            })
            .catch((error: Error) => {
                showNodeAlert(`Error saving STL file. Error: ${error.message}`,
                                "captureSTL");
            });
        }
    });

    // Record movie
    let movieCaptureRunning = false;
    let capturer: CaptureMovie;
    watchEffect(() => {
        if(controlStore.movie) {

            resetNodeAlert();
            askNode("SYSTEM", "movie-start")
                .then((params: CtrlParams) => {

                    const filename = params.filename as string;
                    if(!filename) {
                        controlStore.movie = false;
                        return;
                    }
                    const extension = params.extension as string;

                    movieCaptureRunning = true;

                    capturer = new CaptureMovie(renderer.domElement, extension);
                    void capturer.saveFrames(filename);
                })
                .catch((error: Error) => {
                    showNodeAlert(error.message, "captureMovie", {alsoSystem: true});
                    controlStore.movie = false;
                });
        }
        else if(movieCaptureRunning) {
            movieCaptureRunning = false;
            capturer.finishFrames();
        }
    });

    // Scene helpers
    setupSceneHelpers();

    // Create lights
    sm.createLights();

    const gizmoOptions: GizmoOptions = {

        size: 170,
        placement: "bottom-right",
        lineWidth: 10,
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

    // Handle viewer resizing
    const setOnResize = (width: number, height: number): void => {

        const aspect = width / height;

        if(configStore.camera.type === "perspective") {
            cameraPerspective.aspect = aspect;
        }
        else {
            setOrthographicAspect(cameraPerspective, cameraOrthographic, aspect);
        }
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);

        viewportGizmo.update();

        sm.modified();
    };

    // Change the camera parameters when the window changes or ask for an expanded view
    const resizeObserver = new ResizeObserver((entries) => {

        for(const entry of entries) {

            const w = entry.borderBoxSize[0].inlineSize;
            const h = entry.borderBoxSize[0].blockSize;

            setOnResize(w, h);
        }
    });
    resizeObserver.observe(cnv.value);

    // Set the events listeners
    viewportGizmo.addEventListener("start", () => (controls.enabled = false));
    viewportGizmo.addEventListener("end", () => (controls.enabled = true));
    viewportGizmo.addEventListener("change", () => {
        void controls.normalizeRotations().setPosition(...camera.position.toArray());
    });

    controls.addEventListener("update", () => {
        controls.getTarget(viewportGizmo.target);
        viewportGizmo.update();
    });

    // Set the target
    void controls.normalizeRotations().setTarget(...viewportGizmo.target.set(0, 3, 0).toArray());
    camera.lookAt(viewportGizmo.target);

    // Rendering function for the run
    const clock = new Timer();
    clock.connect(document);
    const animate = (): void => {

        clock.update();
        const doRender = controls.update(clock.getDelta());
        if(doRender || sm.needRendering()) {

            const labels = scene.getObjectByName("AtomLabels") as BillboardBatchedText;

            if(labels) labels.update(camera);

            renderer.render(scene, camera);
            if(configStore.helpers.showGizmo) viewportGizmo.render();
        }
    };

    // First time render everything
    clock.update();
    controls.update(clock.getDelta());
    renderer.render(scene, camera);
    if(configStore.helpers.showGizmo) viewportGizmo.render();
    const labels = scene.getObjectByName("AtomLabels") as BillboardBatchedText;
    if(labels) labels.update(camera);

    // Start run
    renderer.setAnimationLoop(animate);
});

</script>


<template>
<div ref="cnv" class="canvas" />
<viewer-legend v-if="controlStore.legend" :bottom="40" :right="10"
               title="Num. bonds"
               :values-discrete="controlStore.legendDiscrete"/>
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
