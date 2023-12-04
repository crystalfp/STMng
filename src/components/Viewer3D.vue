<script setup lang="ts">

import {onMounted, ref, watch} from "vue";
import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import type {Viewer3DConfiguration, Object3D} from "@/types";


const props = defineProps<{

    /** Routine to remove the given idx tab */
    expanded: boolean;

}>();

const config: Viewer3DConfiguration = {

    camera: {
        perspective: true
    },
    scene: {
        background: "skyblue",
        showGrid: false,
        showAxis: false,
    },
    lights: {
        ambientColor: "white",
        ambientIntensity: 1,
        directional1Color: "yellow",
        directional1Intensity: 3,
        directional2Color: "yellow",
        directional2Intensity: 3,
        directional3Color: "yellow",
        directional3Intensity: 3,
        directional1Position: [0, 200, 0],
        directional2Position: [100, 200, 100],
        directional3Position: [-100, -200, -100],
    }
};


const objects: Object3D[] = [
    {type: "sphere", radius: 1, position: [3, 2, -5], color: "green"},
    {type: "cube", sides: [1, 1, 1], position: [0, 1, 1], color: "blue"},
    {type: "cylinder", radius: 0.2, start: [0, 1, 1], end: [3, 2, -5], color: "rgb(255, 255, 0)"},
];

const createMaterial = (color: string |number): THREE.Material => {

    return new THREE.MeshStandardMaterial({
                    color,
					roughness: 0.7,
                    metalness: 0.3,
                    side: THREE.DoubleSide,
                    // depthTest: true,
                    // depthWrite: true,
                });
};

const cnv = ref<HTMLElement | null>(null);
onMounted(() => {

    if(!cnv.value) {
        console.log("Cannot create canvas");
        return;
    }

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(config.scene.background);

    // Create camera
    let aspect = cnv.value.clientWidth / cnv.value.clientHeight;
    const camera = config.camera.perspective ?
                        new THREE.PerspectiveCamera(75, aspect, 0.1, 1000) :
                        new THREE.OrthographicCamera(-5*aspect, 5*aspect, -5, 5, 0.1, 1000);
    camera.position.z = 5;

    // Add renderer
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(cnv.value.clientWidth, cnv.value.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    cnv.value.append(renderer.domElement);

    // Add mouse controls
    void new OrbitControls(camera, renderer.domElement);

    // Add directional lights
    if(config.lights.directional1Color && config.lights.directional1Intensity) {
        const light1 = new THREE.DirectionalLight(config.lights.directional1Color,
                                                  config.lights.directional1Intensity);
        light1.position.set(...config.lights.directional1Position ?? [10, 0, 0]);
        scene.add(light1);
    }
    if(config.lights.directional2Color && config.lights.directional2Intensity) {
        const light2 = new THREE.DirectionalLight(config.lights.directional2Color,
                                                  config.lights.directional2Intensity);
        light2.position.set(...config.lights.directional2Position ?? [0, 10, 0]);
        scene.add(light2);
    }
    if(config.lights.directional3Color && config.lights.directional3Intensity) {
        const light3 = new THREE.DirectionalLight(config.lights.directional3Color,
                                                  config.lights.directional3Intensity);
        light3.position.set(...config.lights.directional3Position ?? [0, 0, 10]);
        scene.add(light3);
    }

    // Add ambient light
    if(config.lights.ambientColor && (config.lights.ambientIntensity ?? 0) > 0) {
        const ambient = new THREE.AmbientLight(config.lights.ambientColor, config.lights.ambientIntensity);
        scene.add(ambient);
    }

    // Show helper objects
    if(config.scene.showAxis) {
        const axesHelper = new THREE.AxesHelper(1);
        scene.add(axesHelper);
    }

    if(config.scene.showGrid) {
        const gridHelper = new THREE.GridHelper(10, 10);
        scene.add(gridHelper);
    }

    // Add scene objects
    for(const obj of objects) {
        switch(obj.type) {
            case "sphere": {
                const geometry = new THREE.SphereGeometry(obj.radius, 32, 16);
                const meshMaterial = createMaterial(obj.color);
                const sphere = new THREE.Mesh(geometry, meshMaterial);
                sphere.position.set(obj.position[0], obj.position[1], obj.position[2]);
                scene.add(sphere);
                break;
            }
            case "cube": {
                const geometry = new THREE.BoxGeometry(obj.sides[0], obj.sides[1], obj.sides[2], 5, 5, 5);
                const meshMaterial = createMaterial(obj.color);
                const cube = new THREE.Mesh(geometry, meshMaterial);
                cube.position.set(obj.position[0], obj.position[1], obj.position[2]);
                scene.add(cube);
                break;
            }
            case "cylinder": {
                const dx = obj.start[0] - obj.end[0];
                const dy = obj.start[1] - obj.end[1];
                const dz = obj.start[2] - obj.end[2];
                const len = Math.hypot(dx, dy, dz);
                const geometry = new THREE.CylinderGeometry(obj.radius, obj.radius, len, 32, 2, true);
                const meshMaterial = createMaterial(obj.color);
                const cylinder = new THREE.Mesh(geometry, meshMaterial);
                cylinder.position.set(obj.start[0]-dx/2, obj.start[1]-dy/2, obj.start[2]-dz/2);
                cylinder.applyQuaternion(vectorToQuaternion(dx/len, -dy/len, dz/len));

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

        if(config.camera.perspective) {
            (camera as THREE.PerspectiveCamera).aspect = aspect;
        }
        else {
            const co = camera as THREE.OrthographicCamera;
            co.left = -5*aspect;
            co.right = 5*aspect;
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
    };
    animate();
});

const vectorToQuaternion = (nx: number, ny: number, nz: number): THREE.Quaternion => {

    const forward = new THREE.Vector3(nx, ny, nz);
    const direction = new THREE.Vector3(0, 1, 0);

    const cosTheta = forward.dot(direction);
    const axis = new THREE.Vector3(0, 0, 0);

    if(cosTheta < -0.999) {
        // special case when vectors in opposite directions:
        // there is no "ideal" rotation axis
        // So guess one; any will do as long as it's perpendicular to start
        axis.crossVectors(new THREE.Vector3(0, 0, 1), forward);

        if(axis.length() * axis.length() < 0.01) {
            axis.crossVectors(new THREE.Vector3(1, 0, 0), forward);
        }
        axis.normalize();
        return new THREE.Quaternion(axis.x, axis.y, axis.z, 0);
    }

    axis.crossVectors(forward, direction);

    const es = Math.sqrt((1 + cosTheta) * 2);
    const invEs = 1 / es;

    return new THREE.Quaternion(
        axis.x * invEs,
        axis.y * invEs,
        axis.z * invEs,
        es * 0.5
    );
};

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
  //   width: calc(100vw - 649px); // Full screen minus columns width minus gutter width
}
</style>
