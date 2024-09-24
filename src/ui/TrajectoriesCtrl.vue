<script setup lang="ts">
/**
 * @component
 * Controls for the atoms' trajectories visualization.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-09-12
 */

import * as THREE from "three";
import {ref, watch} from "vue";
import {storeToRefs} from "pinia";
import {useControlStore} from "@/stores/controlStore";
import {askNode, receiveTracesFromNode, sendToNode,
        receivePositionCloudsFromNode} from "@/services/RoutesClient";
import {showAlertMessage} from "@/services/AlertMessage";
import {sm} from "@/services/SceneManager";
import {VolumeRenderShader} from "@/services/VolumeShader";

// > Properties
const {id} = defineProps<{

    /** Its own module id */
    id: string;
}>();

// Show this module has been loaded and access the control store
const controlStore = useControlStore();
controlStore.hasTrajectory = true;

const showTrajectories = ref(false);
const labelKind = ref("symbol");
const atomsSelector = ref("");
const maxDisplacement = ref(1);
const showPositionClouds = ref(false);

const positionCloudsGrow = ref(0.1);
const positionCloudsSideExp = ref(5);
let positionCloudsSide = 32; // This is 2**positionCloudsSideExp
let positionCloud: Float32Array | undefined;
const positionLimits: number[] = [];
let maxCount = 0;

// > Graphical objects
const group = new THREE.Group();
const groupName = "Trajectories-" + id;
group.name = groupName;
group.visible = showTrajectories.value;
sm.add(group);

const volumeName = "PositionCloudVolume-" + id;
let volumeMesh: THREE.Mesh | undefined;

// > Initialize the ui
askNode(id, "init")
    .then((params) => {
        showTrajectories.value      = params.showTrajectories as boolean ?? false;
        labelKind.value             = params.labelKind as string ?? "symbol";
        atomsSelector.value         = params.atomsSelector as string ?? "";
        maxDisplacement.value       = params.maxDisplacement as number ?? 1;
        showPositionClouds.value    = params.showPositionClouds as boolean ?? false;
        positionCloudsSideExp.value = params.positionCloudsSideExp as number ?? 5;
        positionCloudsSide          = 2**positionCloudsSideExp.value;
        positionCloudsGrow.value    = params.positionCloudsGrow as number ?? 0.1;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for Trajectories: ${error.message}`));

/**
 * Create a colormap
 *
 * @remarks Use lut {@link https://threejs.org/docs/#examples/en/math/Lut}
 *			then .lut and convert list of colors into Uint8Array
 *			or createCanvas() method
 * @param bw - True for a Black&White colormap
 * @returns The texture 256x1 with the colormap
 */
const generateColormap = (bw: boolean): THREE.Texture => {

    const width = 256;
    const height = 1;

    const data = new Uint8Array(4 * width);

    if(bw) {
        for(let i = 0; i < width; i ++) {
            const stride = i * 4;
            data[stride]   = i;
            data[stride+1] = i;
            data[stride+2] = i;
            data[stride+3] = 255;
        }
    }
    else {
        const startColor = new THREE.Color("red");
        const endColor   = new THREE.Color("green");
        const lerpIncr = 1/width;
        for(let i = 0; i < width; i ++) {
            const lerpColor = new THREE.Color(startColor);
            lerpColor.lerpHSL(endColor, i * lerpIncr);
            const stride = i * 4;
            data[stride]   = lerpColor.r*255;
            data[stride+1] = lerpColor.g*255;
            data[stride+2] = lerpColor.b*255;
            data[stride+3] = 255;
        }
    }

    // Used the buffer to create a DataTexture
    const texture = new THREE.DataTexture(data, width, height);
    texture.needsUpdate = true;

    // Specify the texture format to match the stored data.
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.UnsignedByteType;
    texture.minFilter = THREE.LinearFilter; // Linear interpolation of colors.
    texture.magFilter = THREE.LinearFilter; // Linear interpolation of colors.
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    return texture;
};

/**
 * Create the rendering material for the volumetric data
 *
 * @returns The material
 */
const createCloudsMaterial = (): THREE.ShaderMaterial => {

    const texture = new THREE.Data3DTexture(positionCloud,
                                            positionCloudsSide,
                                            positionCloudsSide,
                                            positionCloudsSide);
    texture.format = THREE.RedFormat;
    texture.type = THREE.FloatType;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;

    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.wrapR = THREE.ClampToEdgeWrapping;

    const shader = VolumeRenderShader;

    const uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    uniforms["u_data"].value = texture;
    uniforms["u_size"].value.set(positionLimits[3],
                                    positionLimits[4],
                                    positionLimits[5]);
    uniforms["u_origin"].value.set(positionLimits[0],
                                    positionLimits[1],
                                    positionLimits[2]);
    uniforms["u_clim"].value.set(0, maxCount);
    // uniforms["u_clim"].value.set(0, 1);
    uniforms["u_renderthreshold"].value = 1; // For ISO renderstyle
    uniforms["u_cmdata"].value = generateColormap(false);

    return new THREE.ShaderMaterial({
        uniforms,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
        side: THREE.BackSide // The volume shader uses the backface as its "reference point"
    });
};

/**
 * Create the volume that will enclose the position clouds
 *
 * @param volume - The volumetric data
 */
const createCloudVolume = (volume?: number[]): void => {

    if(positionLimits.length === 0) return;

    if(volume) {
        positionCloud = new Float32Array(volume);
    }
    else {
        positionCloud = new Float32Array(positionCloudsSide*
                                         positionCloudsSide*
                                         positionCloudsSide);
        positionCloud.fill(0);
    }

    const sx = positionLimits[3];
    const sy = positionLimits[4];
    const sz = positionLimits[5];

    const geometry = new THREE.BoxGeometry(sx, sy, sz);
    const tx = sx/2 + positionLimits[0];
    const ty = sy/2 + positionLimits[1];
    const tz = sz/2 + positionLimits[2];
    geometry.translate(tx, ty, tz);

    volumeMesh = new THREE.Mesh(geometry, createCloudsMaterial());
    volumeMesh.name = volumeName;
    sm.add(volumeMesh);
};

/**
 * Clear the volumetric mesh
 */
const removePositionClouds = (): void => {

    sm.deleteMesh(volumeName);
    volumeMesh = undefined;
};

/**
 * Update the position cloud volume regenerating the volume
 */
const updateCloudVolume = (): void => {

	removePositionClouds();
	createCloudVolume();
};

/**
 * Convert the exponent to the power of 2
 *
 * @param value - Exponent
 */
const showPowerOf2 = (value: number): string => (2**value).toFixed(0);

/**
 * Clear the accumulated structures
 */
const resetTraces = (): void => {

	sm.clearGroup(groupName);

    sendToNode(id, "reset");
};

/**
 * Toggle capturing trajectories
 */
const toggleRecording = (): void => {

    controlStore.trajectoriesRecording = !controlStore.trajectoriesRecording;
};

const {trajectoriesRecording} = storeToRefs(controlStore);
watch(trajectoriesRecording, () => {

    sendToNode(id, "run", {
        createTrajectories: controlStore.trajectoriesRecording
    });
});

/** Capture selection of atoms to trace */
watch([labelKind, atomsSelector], () => {

    sendToNode(id, "select", {
        labelKind: labelKind.value,
        atomsSelector: atomsSelector.value,
    });
});

/** Max displacement to consider a single trace */
watch([maxDisplacement], () => {

    sendToNode(id, "gap", {
        maxDisplacement: maxDisplacement.value,
    });
});

/** Capture position clouds related variables */
watch([showPositionClouds, positionCloudsSideExp, positionCloudsGrow],
      (after: [boolean, number, number], before: [boolean, number, number]) => {

    if(before[1] !== after[1] || before[2] !== after[2]) {

        positionCloudsSide = 2**after[1];

        if(volumeMesh) updateCloudVolume();
    }
    else {

        if(volumeMesh) removePositionClouds();
        if(after[0]) createCloudVolume();
    }

    sendToNode(id, "clouds", {
        showPositionClouds: showPositionClouds.value,
        positionCloudsSideExp: positionCloudsSideExp.value,
        positionCloudsGrow: positionCloudsGrow.value,
    });
});

/**
 * Receive a set of traces
 *
 * @param segments - List of coordinates arrays for each trace segment
 * @param colors - Color of each segment
 */
const receiveTraces = (segments: number[][], colors: string[]): void => {

	sm.clearGroup(groupName);

    let idx = 0;
    for(const segment of segments) {

        const points: THREE.Vector3[] = [];
        const len = segment.length;
        for(let i=0; i < len; i+=3) {
            points.push(new THREE.Vector3(segment[i], segment[i+1], segment[i+2]));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({color: colors[idx]});
        const line = new THREE.Line(geometry, material);
        group.add(line);
        ++idx;
    }
};
receiveTracesFromNode(id, "traces", receiveTraces);

/**
 * Receive volumetric data
 *
 * @param volume - Volumetric data
 * @param limits - Limits of the volumetric data [volume origin (x3), volume sides (x3)]
 * @param count - Max count of presence in the volume cells
 */
const receivePositionClouds = (volume: number[], limits: number[], count: number): void => {

    maxCount = count;
    for(let i=0; i < 6; ++i) positionLimits[i] = limits[i];

    if(volumeMesh) removePositionClouds();
    if(showPositionClouds.value) {
        createCloudVolume(volume);
    }
};
receivePositionCloudsFromNode(id, "volume", receivePositionClouds);

</script>


<template>
<v-container class="container">
  <v-switch v-model="showTrajectories" color="primary" label="Show trajectories"
            density="compact" class="mt-2 ml-2" @update:modelValue="group.visible = showTrajectories" />
  <v-btn block class="mb-6" @click="resetTraces">Clear trajectories</v-btn>
  <g-atoms-selector v-model:kind="labelKind" v-model:selector="atomsSelector"
                    :disabled="trajectoriesRecording"
                    title="Select traced atoms by" placeholder="Traced atoms selector" />
  <g-debounced-slider v-slot="{value}" v-model="maxDisplacement"
                      :disabled="trajectoriesRecording"
                      :step="0.01" :min="0.01" :max="3" class="ml-1 my-4">
    <v-label :text="`Max displacement (${value.toFixed(2)})`" class="no-select" />
  </g-debounced-slider>
  <v-switch v-model="showPositionClouds" color="primary" label="Show position clouds"
            density="compact" class="ml-2" />
  <v-container v-if="showPositionClouds" class="pa-0">
    <g-debounced-slider v-slot="{value}" v-model="positionCloudsSideExp"
                        :step="1" :min="3" :max="10" class="ml-1">
      <v-label :text="`Cloud volume subdivisions (${showPowerOf2(value)})`" class="no-select" />
    </g-debounced-slider>
    <g-debounced-slider v-slot="{value}" v-model="positionCloudsGrow"
                        :step="0.1" :min="0" :max="1" class="ml-1 my-4">
      <v-label :text="`Enlarge volume (${value*100}%)`" class="no-select" />
    </g-debounced-slider>
  </v-container>
  <v-btn block :disabled="atomsSelector.trim() === '' && labelKind !== 'all'" @click="toggleRecording">
    {{ controlStore.trajectoriesRecording ? "Stop trajectories" : "Start trajectories" }}
  </v-btn>
</v-container>
</template>
