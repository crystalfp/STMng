<!-- eslint-disable id-length -->
<script setup lang="ts">
import {onMounted, ref, watch} from "vue";
import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import type {Atom, Bond} from "@/types";
import {CSS3DRenderer} from "three/addons/renderers/CSS3DRenderer.js";
import {useConfigStore} from "@/stores/configStore";
import {Structure2Object3D} from "@/services/Structure2Object3D";
import {createAxisHelper, createGridHelper,
        createSphere, createCube, createCylinder} from "@/services/HelperObjects";
// import {ViewHelper} from "three/examples/jsm/helpers/ViewHelper.js";
import {createScene} from "@/services/CreateScene";

// > Access the store
const configStore = useConfigStore();

// > Properties
const props = defineProps<{

    /** True if the viewer part is expanded */
    expanded: boolean;

}>();


const atoms: Atom[] = [
    {Z: 8, position: [2.0000,  0.0000,  0.1173]},
    {Z: 1, position: [2.0000,  0.7572, -0.4692]},
    {Z: 1, position: [2.0000, -0.7572, -0.4692]},
];
const bonds: Bond[] =[
    {from: 0, to: 1, kind: "normal"},
    {from: 0, to: 2, kind: "normal"},
];

const structure = new Structure2Object3D("");

const objects = structure.structure2object(atoms, bonds);

// Reference to the view
const cnv = ref<HTMLElement | null>(null);

// Create scene
const scene = createScene();

onMounted(() => {

    if(!cnv.value) {
        console.log("Cannot create canvas");
        return;
    }

    // Create camera
    let aspect = cnv.value.clientWidth / cnv.value.clientHeight;
    const side = configStore.camera.orthoSide;
    const camera = configStore.camera.perspective ?
                        new THREE.PerspectiveCamera(70, aspect, 0.1, 1000) :
                        new THREE.OrthographicCamera(-side*aspect, side*aspect, -side, side, 0.1, 1000);
    camera.position.set(5, 3, -5);

    // Add renderer
    const renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(cnv.value.clientWidth, cnv.value.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    cnv.value.append(renderer.domElement);


    const labelRenderer = new CSS3DRenderer();
    labelRenderer.setSize(cnv.value.clientWidth, cnv.value.clientHeight);

    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0px";
    labelRenderer.domElement.style.pointerEvents = "none";
    cnv.value.append(labelRenderer.domElement);

    // Add mouse controls
    void new OrbitControls(camera, renderer.domElement);

    // Add directional lights
    if(configStore.lights.directional1Color && configStore.lights.directional1Intensity) {
        const light1 = new THREE.DirectionalLight(configStore.lights.directional1Color,
                                                  configStore.lights.directional1Intensity);
        light1.position.set(...configStore.lights.directional1Position ?? [1, 0, 0]);
        scene.add(light1);
    }
    if(configStore.lights.directional2Color && configStore.lights.directional2Intensity) {
        const light2 = new THREE.DirectionalLight(configStore.lights.directional2Color,
                                                  configStore.lights.directional2Intensity);
        light2.position.set(...configStore.lights.directional2Position ?? [0, 1, 0]);
        scene.add(light2);
    }
    if(configStore.lights.directional3Color && configStore.lights.directional3Intensity) {
        const light3 = new THREE.DirectionalLight(configStore.lights.directional3Color,
                                                  configStore.lights.directional3Intensity);
        light3.position.set(...configStore.lights.directional3Position ?? [0, 0, 1]);
        scene.add(light3);
    }

    // Add ambient light
    if(configStore.lights.ambientColor && (configStore.lights.ambientIntensity ?? 0) > 0) {
        const ambient = new THREE.AmbientLight(configStore.lights.ambientColor, configStore.lights.ambientIntensity);
        scene.add(ambient);
    }

    // Add, if needed, helper objects
    createAxisHelper(scene);

    createGridHelper(scene);

    // const viewHelper = new ViewHelper(camera, renderer.domElement);

    // Add scene objects
    const objQuality = configStore.scene.quality;
    for(const obj of objects) {
        switch(obj.type) {
            case "sphere": {
                const sphere = createSphere(obj.radius, obj.color, obj.position, objQuality);
                scene.add(sphere);
                break;
            }
            case "cube": {
                const cube = createCube(obj.sides, obj.color, obj.position, objQuality);
                scene.add(cube);
                break;
            }
            case "cylinder": {
                const cylinder = createCylinder(obj.start, obj.end,
							                    obj.radius, obj.colorStart,
							                    obj.colorEnd, objQuality);
                scene.add(cylinder);
                break;
            }
            default:
                console.log(`Object "${JSON.stringify(obj, undefined, 2)}" is not implemented`);
        }
    }

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
        labelRenderer.render(scene, camera);
        // viewHelper.render(renderer);
    };
    animate();
});

/*
function removeObject3D(object3D) {
    if (!(object3D instanceof THREE.Object3D)) return false;

    // for better memory management and performance
    if (object3D.geometry) object3D.geometry.dispose();

    if (object3D.material) {
        if (object3D.material instanceof Array) {
            // for better memory management and performance
            object3D.material.forEach(material => material.dispose());
        } else {
            // for better memory management and performance
            object3D.material.dispose();
        }
    }
    object3D.removeFromParent(); // the parent might be the scene or another Object3D, but it is sure to be removed this way
    return true;
}
*/
</script>


<template>
<div ref="cnv" class="canvas" />
</template>


<style scoped lang="scss">

@use "@/styles/colors";
@use "@/styles/fonts";

.canvas {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  flex-grow: 1;
}
</style>
