<script setup lang="ts">
/**
 * @component
 * Viewer 3D initial prototype
 */

import {onMounted, ref, watch, watchEffect} from "vue";
import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import type {Atom, Bond, BasisType, PositionType} from "@/types";
import {CSS3DRenderer} from "three/addons/renderers/CSS3DRenderer.js";
import {useConfigStore} from "@/stores/configStore";
import {Structure2Object3D} from "@/services/Structure2Object3D";
import {createAxisHelper, createGridHelper,
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

// Fake data
const atoms: Atom[] = [
    {atomZ: 8, label: "O", position: [2.0000,  0.0000,  0.1173]},
    {atomZ: 1, label: "H", position: [2.0000,  0.7572, -0.4692]},
    {atomZ: 1, label: "H", position: [2.0000, -0.7572, -0.4692]},
];
const bonds: Bond[] =[
    {from: 0, to: 1, type: "n"},
    {from: 0, to: 2, type: "n"},
];

const cellOrigin: PositionType = [
      0,
      0,
      0
    ];
const cellBasis: BasisType = [
      6.652,
      0,
      0,
      2.855910279727731,
      7.213205977521055,
      0,
      1.972317336072774,
      1.7677934806298545,
      7.704445439852851
    ];


const addUnitCell = (orig: PositionType, basis: BasisType, dashed: boolean): THREE.LineSegments => {

    const geometry = new THREE.BufferGeometry();

    const vertices = new Float32Array([
/* 0 */ orig[0],                            orig[1],                            orig[2],
/* 1 */ orig[0]+basis[0],                   orig[1]+basis[1],                   orig[2]+basis[2],
/* 2 */ orig[0]+basis[0]+basis[3],          orig[1]+basis[1]+basis[4],          orig[2]+basis[2]+basis[5],
/* 3 */ orig[0]+basis[3],                   orig[1]+basis[4],                   orig[2]+basis[5],
/* 4 */ orig[0]+basis[6],                   orig[1]+basis[7],                   orig[2]+basis[8],
/* 5 */ orig[0]+basis[0]+basis[6],          orig[1]+basis[1]+basis[7],          orig[2]+basis[2]+basis[8],
/* 6 */ orig[0]+basis[0]+basis[3]+basis[6], orig[1]+basis[1]+basis[4]+basis[7], orig[2]+basis[2]+basis[5]+basis[8],
/* 7 */ orig[0]+basis[3]+basis[6],          orig[1]+basis[4]+basis[7],          orig[2]+basis[5]+basis[8],
    ]);

    const indices = [
        0, 1, 2,
        0, 2, 3,

        4, 5, 1,
        4, 1, 0,

        3, 2, 6,
        3, 6, 7,

        4, 0, 3,
        4, 3, 7,

        1, 5, 6,
        1, 6, 2,

        5, 4, 7,
        5, 7, 6,
    ];

    geometry.setIndex(indices);
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

	const edges = new THREE.EdgesGeometry(geometry);
    if(dashed) {
        const line = new THREE.LineSegments(edges,
                                    new THREE.LineDashedMaterial({
                                            color: 0x0000FF,
                                            linewidth: 1,
                                            scale: 5,
                                            dashSize: 1,
                                            gapSize: 1,
                                    })
        );
        line.computeLineDistances();
        return line;
    }
	return new THREE.LineSegments(edges, new THREE.LineBasicMaterial({color: 0x0000FF}));
};

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
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.listenToKeyEvents(window);
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

    scene.add(addUnitCell(cellOrigin, cellBasis, true));

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
