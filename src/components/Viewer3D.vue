<!-- eslint-disable id-length -->
<script setup lang="ts">
import {onMounted, ref, watch, watchEffect} from "vue";
import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import type {Atom, Bond} from "@/types";
import {CSS3DRenderer} from "three/addons/renderers/CSS3DRenderer.js";
import {useConfigStore} from "@/stores/configStore";
import {Structure2Object3D} from "@/services/Structure2Object3D";
import {createAxisHelper, createGridHelper, createWireframe,
        createSphere, createCube, createCylinder} from "@/services/HelperObjects";
// import {ViewHelper} from "three/examples/jsm/helpers/ViewHelper.js";
import {createScene} from "@/services/CreateScene";
import {createLights} from "@/services/CreateLights";
import {setMaterialParams, adjustMaterials} from "@/services/DefineMaterials";

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


    const labelRenderer = new CSS3DRenderer();
    labelRenderer.setSize(cnv.value.clientWidth, cnv.value.clientHeight);

    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0px";
    labelRenderer.domElement.style.pointerEvents = "none";
    cnv.value.append(labelRenderer.domElement);

    // Add mouse controls
    void new OrbitControls(camera, renderer.domElement);
    watchEffect(() => {
        camera = configStore.camera.perspective ? cameraPerspective : cameraOrthographic;
        camera.updateProjectionMatrix();
    });

    createLights(scene);

    // Add, if needed, helper objects
    createAxisHelper(scene);

    createGridHelper(scene);
// const helper = new THREE.CameraHelper( camera );
// scene.add( helper );
    // const viewHelper = new ViewHelper(camera, renderer.domElement);

    scene.add(createWireframe([0, 0, 0], [1, 2, 3]));

    // Add scene objects
    const molecule = new THREE.Group;
    setMaterialParams();
    for(const obj of objects) {
        switch(obj.type) {
            case "sphere": {
                const sphere = createSphere(obj.radius, obj.color, obj.position);
                molecule.add(sphere);
                break;
            }
            case "cube": {
                const cube = createCube(obj.sides, obj.color, obj.position);
                scene.add(cube);
                break;
            }
            case "cylinder": {
                const cylinder = createCylinder(obj.start, obj.end,
							                    obj.radius, obj.colorStart,
							                    obj.colorEnd);
                molecule.add(cylinder);
                break;
            }
            default:
                console.log(`Object "${JSON.stringify(obj, undefined, 2)}" is not implemented`);
        }
    }
    scene.add(molecule);
    adjustMaterials(molecule);

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
