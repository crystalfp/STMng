<script setup lang="ts">
/**
 * @component
 * Controls for the viewer.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */

import {computed, ref, watch} from "vue";
import {useConfigStore} from "@/stores/configStore";
import {useControlStore} from "@/stores/controlStore";
import {askNode, sendViewer3DState} from "@/services/RoutesClient";
import {showSystemAlert} from "@/services/AlertMessage";
import AlignLabels from "@/widgets/AlignLabels.vue";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

/** Convert degrees to radiants */
const DEG2RAD = Math.PI/180;

// > Access the store
const configStore = useConfigStore();
const controlStore = useControlStore();

// Initialize the parameters
askNode(id, "init")
    .then((params) => {

        configStore.restoreState(params.rawStatus as string);
    })
    .catch((error: Error) => showSystemAlert(`Error from UI init for ${label}: ${error.message}`));

// Send state on request from main process
sendViewer3DState(id, "state", () => configStore.statusToSave);

// > First directional light
const alpha1 = ref(0);  // Around X on YZ plane
const beta1 = ref(0);   // Angle with X axis

watch([alpha1, beta1], () => {
    const alphaRad = alpha1.value * DEG2RAD;
    const betaRad  = beta1.value * DEG2RAD;
    const lenYZ = Math.sin(betaRad);
    configStore.lights.directional1Position[0] = Math.cos(betaRad);
    configStore.lights.directional1Position[1] = lenYZ*Math.cos(alphaRad);
    configStore.lights.directional1Position[2] = -lenYZ*Math.sin(alphaRad);
});

// > Second directional light
const alpha2 = ref(0);
const beta2 = ref(0);

watch([alpha2, beta2], () => {
    const alphaRad = alpha2.value * DEG2RAD;
    const betaRad  = beta2.value * DEG2RAD;
    const lenXZ = Math.sin(betaRad);
    configStore.lights.directional2Position[0] = lenXZ*Math.sin(alphaRad);
    configStore.lights.directional2Position[1] = Math.cos(betaRad);
    configStore.lights.directional2Position[2] = lenXZ*Math.cos(alphaRad);
});

// > Third directional light
const alpha3 = ref(0);
const beta3 = ref(0);

watch([alpha3, beta3], () => {
    const alphaRad = alpha3.value * DEG2RAD;
    const betaRad  = beta3.value * DEG2RAD;
    const lenXY = Math.sin(betaRad);
    configStore.lights.directional3Position[0] = lenXY*Math.cos(alphaRad);
    configStore.lights.directional3Position[1] = lenXY*Math.sin(alphaRad);
    configStore.lights.directional3Position[2] = Math.cos(betaRad);
});

// > Positioning camera
const forcedCameraPositionX = ref(configStore.camera.forcePosition[0]);
const forcedCameraPositionY = ref(configStore.camera.forcePosition[1]);
const forcedCameraPositionZ = ref(configStore.camera.forcePosition[2]);

const forcedCameraLookAtX = ref(configStore.camera.forceLookAt[0]);
const forcedCameraLookAtY = ref(configStore.camera.forceLookAt[1]);
const forcedCameraLookAtZ = ref(configStore.camera.forceLookAt[2]);

/**
 * Load the current camera position and lookAt in the user interface
 */
const loadPosition = (): void => {

    forcedCameraPositionX.value = configStore.camera.position[0];
    forcedCameraPositionY.value = configStore.camera.position[1];
    forcedCameraPositionZ.value = configStore.camera.position[2];

    forcedCameraLookAtX.value = configStore.camera.lookAt[0];
    forcedCameraLookAtY.value = configStore.camera.lookAt[1];
    forcedCameraLookAtZ.value = configStore.camera.lookAt[2];
};

/**
 * Set the camera position and lookAt to the ones set in the user interface
 */
const forcePosition = (): void => {

    configStore.camera.position[0] = forcedCameraPositionX.value;
    configStore.camera.position[1] = forcedCameraPositionY.value;
    configStore.camera.position[2] = forcedCameraPositionZ.value;

    configStore.camera.lookAt[0] = forcedCameraLookAtX.value;
    configStore.camera.lookAt[1] = forcedCameraLookAtY.value;
    configStore.camera.lookAt[2] = forcedCameraLookAtZ.value;

    configStore.camera.forcePosition[0] = forcedCameraPositionX.value;
    configStore.camera.forcePosition[1] = forcedCameraPositionY.value;
    configStore.camera.forcePosition[2] = forcedCameraPositionZ.value;

    configStore.camera.forceLookAt[0] = forcedCameraLookAtX.value;
    configStore.camera.forceLookAt[1] = forcedCameraLookAtY.value;
    configStore.camera.forceLookAt[2] = forcedCameraLookAtZ.value;

    controlStore.force = true;
};

/** Simplify label */
const cameraType = computed(() => `Camera type (${configStore.camera.type})`);

</script>


<template>
<v-container class="container">
  <v-expansion-panels class="mt-2">
    <v-expansion-panel>
      <v-expansion-panel-title>
        {{ cameraType }}
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-btn-toggle v-model="configStore.camera.type" mandatory
                      class="mt-2 mb-n2 w-100 justify-center">
          <v-btn value="perspective">Perspective</v-btn>
          <v-btn value="orthographic">Orthographic</v-btn>
        </v-btn-toggle>
      </v-expansion-panel-text>
    </v-expansion-panel>
    <v-expansion-panel>
      <v-expansion-panel-title>
        Camera positioning
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-label text="Camera position" class="mb-4 no-select" />
        <v-row class="pl-1">
          <v-number-input v-model="forcedCameraPositionX" label="x"
                          :step="0.1" :precision="1" class="ml-2 mr-0" />
          <v-number-input v-model="forcedCameraPositionY" label="y"
                          :step="0.1" :precision="1" class="ml-2 mr-0" />
          <v-number-input v-model="forcedCameraPositionZ" label="z"
                          :step="0.1" :precision="1" class="ml-2 mr-0" />
        </v-row>
        <v-label text="Camera look at" class="mb-4 no-select" />
        <v-row class="pl-1">
          <v-number-input v-model="forcedCameraLookAtX" label="x"
                          :step="0.1" :precision="1" class="ml-2 mr-0" />
          <v-number-input v-model="forcedCameraLookAtY" label="y"
                          :step="0.1" :precision="1" class="ml-2 mr-0" />
          <v-number-input v-model="forcedCameraLookAtZ" label="z"
                          :step="0.1" :precision="1" class="ml-2 mr-0" />
        </v-row>
        <v-row class="d-flex justify-center gc-2 pl-4 pb-1">
          <v-btn density="comfortable" @click="loadPosition">Load current</v-btn>
          <v-btn density="comfortable" @click="forcePosition">Force position</v-btn>
        </v-row>
      </v-expansion-panel-text>
    </v-expansion-panel>
    <v-expansion-panel>
      <v-expansion-panel-title>
        Scene
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-label text="Background color" class="mb-2 no-select" />
        <v-color-picker v-model="configStore.scene.background"
                        :modes="['rgb', 'hsl', 'hex']" elevation="0" />
      </v-expansion-panel-text>
    </v-expansion-panel>
    <v-expansion-panel>
      <v-expansion-panel-title>
        Ambient light
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-label text="Light color" class="mb-2 no-select" />
        <v-color-picker v-model="configStore.lights.ambientColor"
                        :modes="['rgb', 'hsl', 'hex']" elevation="0" />
        <v-slider v-model="configStore.lights.ambientIntensity" label="Intensity" density="comfortable"
                  min="0" max="3" step="0.1" thumb-label />
      </v-expansion-panel-text>
    </v-expansion-panel>
    <v-expansion-panel>
      <v-expansion-panel-title>
        Directional lights
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-label text="Directional light 1" class="mb-2 no-select" />
        <v-color-picker v-model="configStore.lights.directional1Color"
                        :modes="['rgb', 'hsl', 'hex']" elevation="0" />
        <align-labels label-width="4.5rem">
          <v-slider v-model="configStore.lights.directional1Intensity" label="Intensity" density="compact"
                    min="0" max="3" step="0.1" thumb-label />
          <v-slider v-model="alpha1" label="Around X" density="compact"
                    min="-180" max="180" step="1" thumb-label />
          <v-slider v-model="beta1" label="Along X" density="compact"
                    min="-90" max="90" step="1" thumb-label />
        </align-labels>
        <v-label text="Directional light 2" class="mb-2 no-select" />
        <v-color-picker v-model="configStore.lights.directional2Color"
                        :modes="['rgb', 'hsl', 'hex']" elevation="0" />
        <align-labels label-width="4.5rem">
          <v-slider v-model="configStore.lights.directional2Intensity" label="Intensity" density="compact"
                    min="0" max="3" step="0.1" thumb-label />
          <v-slider v-model="alpha2" label="Around Y" density="compact"
                    min="-180" max="180" step="1" thumb-label />
          <v-slider v-model="beta2" label="Along Y" density="compact"
                    min="-90" max="90" step="1" thumb-label />
        </align-labels>
        <v-label text="Directional light 3" class="mb-2 no-select" />
        <v-color-picker v-model="configStore.lights.directional3Color"
                        :modes="['rgb', 'hsl', 'hex']" elevation="0" />
        <align-labels label-width="4.5rem">
          <v-slider v-model="configStore.lights.directional3Intensity" label="Intensity" density="compact"
                    min="0" max="3" step="0.1" thumb-label />
          <v-slider v-model="alpha3" label="Around Z" density="compact"
                    min="-180" max="180" step="1" thumb-label />
          <v-slider v-model="beta3" label="Along Z" density="compact"
                    min="-90" max="90" step="1" thumb-label />
        </align-labels>
      </v-expansion-panel-text>
    </v-expansion-panel>
    <v-expansion-panel>
      <v-expansion-panel-title>
        Helper objects
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-switch v-model="configStore.helpers.showAxis"
                  label="Show axis" class="mt-3 mb-4" />
        <align-labels label-width="5rem" class="ml-n4 mt-n5">
          <v-slider v-model="configStore.helpers.axisLength" label="Axis length" density="compact"
                    min="0.5" max="20" step="0.5" thumb-label />
        </align-labels>
        <v-switch v-model="configStore.helpers.showGridXZ"
                  label="Show grid XZ" class="mt-n6" />
        <v-switch v-model="configStore.helpers.showGridXY"
                  label="Show grid XY" />
        <v-switch v-model="configStore.helpers.showGridYZ"
                  label="Show grid YZ" />
        <align-labels label-width="5rem" class="ml-n4">
          <v-slider v-model="configStore.helpers.gridSize" label="Grid side" density="compact"
                    min="2" max="40" step="2" thumb-label />
        </align-labels>
        <v-switch v-model="configStore.helpers.showGizmo"
                  label="Show orientation axis" class="mt-n6" />
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</v-container>
</template>
