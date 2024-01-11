<script setup lang="ts">
/**
 * @component
 * Viewer 3D initial prototype
 */

import {onMounted, ref, watch, watchEffect, nextTick} from "vue";
import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {useConfigStore} from "@/stores/configStore";
// import {ViewHelper} from "three/examples/jsm/helpers/ViewHelper.js";
import {createScene} from "@/services/CreateScene";
import {createLights} from "@/services/CreateLights";
import log from "electron-log";

// > Access the store
const configStore = useConfigStore();

// > Properties
const props = defineProps<{

    /** True if the viewer part is expanded */
    expanded: boolean;

}>();

// Reference to the view
const cnv = ref<HTMLElement | null>(null);

// Create scene
const scene = createScene();

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

onMounted(() => {

    if(!cnv.value) {
        log.error("Cannot create canvas. Quitting.");
        return;
    }

    // Create cameras
    const cameraPerspective = new THREE.PerspectiveCamera(75,
                                                          cnv.value.clientWidth / cnv.value.clientHeight,
                                                          0.1, 5000);
    cameraPerspective.position.set(5, 3, 5);

    const cameraOrthographic = new THREE.OrthographicCamera();
    copyPerspectiveCamera(cameraPerspective, cameraOrthographic);

    let camera = configStore.camera.perspective ? cameraPerspective : cameraOrthographic;

    // Add renderer
    const renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(cnv.value.clientWidth, cnv.value.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    cnv.value.append(renderer.domElement);

    // Add mouse controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.listenToKeyEvents(window);
    controls.addEventListener("end", () => {
        configStore.camera.position = [camera.position.x, camera.position.y, camera.position.z];
    });

    // Switch cameras
    watchEffect(() => {

        if(configStore.camera.perspective) {

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
        controls.object = camera;
        controls.update();
    });

    // Reset camera
    watchEffect(() => {
        if(configStore.control.reset) {
            configStore.control.reset = false;

            cameraPerspective.position.set(5, 3, 5);
            cameraPerspective.lookAt(new THREE.Vector3(0, 0, 0));
            cameraPerspective.zoom = 1;

            copyPerspectiveCamera(cameraPerspective, cameraOrthographic);
            cameraOrthographic.updateProjectionMatrix();
        }
        controls.update();
    });

    createLights(scene);

    // const helper = new THREE.CameraHelper( camera );
    // scene.add( helper );
    // const viewHelper = new ViewHelper(camera, renderer.domElement);

    // Change the camera parameters when the window changes or ask for a expanded view
    const resizeScene = (): void => {

        void nextTick().then(() => {

            const aspect = cnv.value!.clientWidth / cnv.value!.clientHeight;

            if(configStore.camera.perspective) {
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
    const animate = (): void => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
        // viewHelper.render(renderer);
    };
    animate();
});

</script>


<template>
<div ref="cnv" class="canvas" />
</template>


<style scoped lang="scss">

.canvas {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  flex-grow: 1;
}
</style>
