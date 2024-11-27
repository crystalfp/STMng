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
import {askNode, receiveTracesFromNode, sendToNode} from "@/services/RoutesClient";
import {showAlertMessage} from "@/services/AlertMessage";
import {sm} from "@/services/SceneManager";
import spriteImage from "@/assets/volumetric-sprite.png";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// Show this module has been loaded and access the control store
const controlStore = useControlStore();
controlStore.hasTrajectory = true;

const showTrajectories = ref(false);
const labelKind = ref("symbol");
const atomsSelector = ref("");
const maxDisplacement = ref(1);
const showPositionClouds = ref(false);
const positionCloudsSize = ref(100);
const positionCloudsColor = ref("#BBBBBE");

// > Graphical objects
const group = new THREE.Group();
const groupName = "Trajectories-" + id;
group.name = groupName;
group.visible = showTrajectories.value;
sm.add(group);

const volumeName = "PositionCloud-" + id;
let volumeMaterial: THREE.PointsMaterial | undefined;
const volumeVertices: number[] = [];
const volumeGeometry = new THREE.BufferGeometry();

/**
 * Initialize the positionCloud material
 */
const initializeVolume = (): void => {

    const textureLoader = new THREE.TextureLoader();

    const sprite = textureLoader.load(spriteImage, (texture: THREE.Texture): void => {

        texture.colorSpace = THREE.SRGBColorSpace;
    });

	volumeMaterial = new THREE.PointsMaterial({
        size: positionCloudsSize.value,
        map: sprite,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        transparent: true
    });

	volumeMaterial.color.set(positionCloudsColor.value);

    volumeVertices.length = 0;
    sm.modified();
};

/**
 * Create the position clouds
 */
const populateVolume = (): void => {

    sm.deleteMesh(volumeName);
    if(volumeVertices.length === 0 || !volumeMaterial) return;

    volumeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(volumeVertices, 3));
	const particles = new THREE.Points(volumeGeometry, volumeMaterial.clone());
    particles.name = volumeName;
    sm.add(particles);
};

// > Initialize the position cloud
initializeVolume();

// > Initialize the ui
askNode(id, "init")
    .then((params) => {
        showTrajectories.value      = params.showTrajectories as boolean ?? false;
        labelKind.value             = params.labelKind as string ?? "symbol";
        atomsSelector.value         = params.atomsSelector as string ?? "";
        maxDisplacement.value       = params.maxDisplacement as number ?? 1;
        showPositionClouds.value    = params.showPositionClouds as boolean ?? false;
		positionCloudsColor.value   = params.positionCloudsColor as string ?? "#BBBBBE";
		positionCloudsSize.value    = params.positionCloudsSize as number ?? 100;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`));

/**
 * Clear the accumulated structures
 */
const resetTraces = (): void => {

	sm.clearGroup(groupName);
    sm.deleteMesh(volumeName);
    volumeVertices.length = 0;

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

/** Max displacement to take part of a single trace */
watch([maxDisplacement], () => {

    sendToNode(id, "gap", {
        maxDisplacement: maxDisplacement.value,
    });
});

/** Capture position clouds related variables */
watch([showPositionClouds, positionCloudsSize, positionCloudsColor],
      (after:  [boolean, number, string],
       before: [boolean, number, string]) => {

    if(volumeMaterial) {
        if(after[2] !== before[2]) {
            volumeMaterial.color.set(after[2]);
        }
        if(after[1] !== before[1]) {
            volumeMaterial.size = after[1];
        }
    }
    if(after[0]) populateVolume();
    else sm.deleteMesh(volumeName);
    sm.modified();

    sendToNode(id, "cloud", {
        showPositionClouds: showPositionClouds.value,
        positionCloudsSize: positionCloudsSize.value,
        positionCloudsColor: positionCloudsColor.value
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

    volumeVertices.length = 0;

    let idx = 0;
    for(const segment of segments) {

        const points: THREE.Vector3[] = [];
        const len = segment.length;
        for(let i=0; i < len; i+=3) {
            points.push(new THREE.Vector3(segment[i], segment[i+1], segment[i+2]));
            volumeVertices.push(segment[i], segment[i+1], segment[i+2]);
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({color: colors[idx]});
        const line = new THREE.Line(geometry, material);
        group.add(line);
        ++idx;
    }

    populateVolume();
};
receiveTracesFromNode(id, "traces", receiveTraces);

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
  <v-container v-if="showPositionClouds" class="pa-0 mb-2">
    <g-debounced-slider v-slot="{value}" v-model="positionCloudsSize"
                        :step="1" :min="10" :max="200" class="ml-1 mb-4">
      <v-label :text="`Point sprite size (${value})`" class="no-select" />
    </g-debounced-slider>
    <g-color-selector v-model="positionCloudsColor" label="Cloud color" />
  </v-container>
  <v-btn block :disabled="atomsSelector.trim() === '' && labelKind !== 'all'" @click="toggleRecording">
    {{ controlStore.trajectoriesRecording ? "Stop trajectories" : "Start trajectories" }}
  </v-btn>
</v-container>
</template>
