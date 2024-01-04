<script setup lang="ts">
/**
 * @component
 * Viewer 3D initial prototype
 */

import {onMounted, ref, watch, watchEffect} from "vue";
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

onMounted(() => {

    if(!cnv.value) {
        log.error("Cannot create canvas. Quitting.");
        return;
    }

    // Create camera
    let aspect = cnv.value.clientWidth / cnv.value.clientHeight;
    const side = configStore.camera.orthoSide;
    // const camera = configStore.camera.perspective ?
    //                     new THREE.PerspectiveCamera(75, aspect, 0.1, 5000) :
    //                     new THREE.OrthographicCamera(-side*aspect, side*aspect, -side, side, 0.1, 1000);

    const cameraPerspective = new THREE.PerspectiveCamera(75, aspect, 0.1, 5000);
    cameraPerspective.position.set(5, 3, -5);
    const cameraOrthographic = new THREE.OrthographicCamera(-side*aspect, side*aspect, side, -side, .1, 5000);
    cameraOrthographic.position.set(-1, -1, 0);

    let camera = configStore.camera.perspective ? cameraPerspective : cameraOrthographic;

    // Add renderer
    const renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(cnv.value.clientWidth, cnv.value.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    cnv.value.append(renderer.domElement);

    // Add mouse controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.listenToKeyEvents(window);
    watchEffect(() => {
        camera = configStore.camera.perspective ? cameraPerspective : cameraOrthographic;
        camera.updateProjectionMatrix();
    });

    createLights(scene);

    // const helper = new THREE.CameraHelper( camera );
    // scene.add( helper );
    // const viewHelper = new ViewHelper(camera, renderer.domElement);

    // Change the camera parameters when the window changes or ask for a expanded view
    const resizeScene = (): void => {

        aspect = cnv.value!.clientWidth / cnv.value!.clientHeight;

        if(configStore.camera.perspective) {
            (camera as THREE.PerspectiveCamera).aspect = aspect;
        }
        else {
            const co = camera as THREE.OrthographicCamera;
            co.left = -side*aspect;
            co.right = side*aspect;
        }
        camera.updateProjectionMatrix();

        renderer.setSize(cnv.value!.clientWidth, cnv.value!.clientHeight);
    };

    window.addEventListener("resize", resizeScene, false);

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
