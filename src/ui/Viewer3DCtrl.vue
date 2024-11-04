<script setup lang="ts">
/**
 * @component
 * Controls for the viewer.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, watchEffect} from "vue";
import {useConfigStore} from "@/stores/configStore";
import {askNode, sendViewer3DState} from "@/services/RoutesClient";
import {showAlertMessage} from "@/services/AlertMessage";

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

// Initialize the parameters
askNode(id, "init")
    .then((params) => {

        configStore.restoreState(params.rawStatus as string);
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`));

// Send state on request from main process
sendViewer3DState(id, "state", () => configStore.statusToSave);

// > First directional light
const alpha1 = ref(0);  // Around X on YZ plane
const beta1 = ref(0);   // Angle with X axis

watchEffect(() => {
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

watchEffect(() => {
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

watchEffect(() => {
    const alphaRad = alpha3.value * DEG2RAD;
    const betaRad  = beta3.value * DEG2RAD;
    const lenXY = Math.sin(betaRad);
    configStore.lights.directional3Position[0] = lenXY*Math.cos(alphaRad);
    configStore.lights.directional3Position[1] = lenXY*Math.sin(alphaRad);
    configStore.lights.directional3Position[2] = Math.cos(betaRad);
});

</script>


<template>
<v-container class="container">
  <v-label class="mb-3 mt-3 w-100 text-h6 justify-center yellow-title no-select">Camera type</v-label><br>
  <v-btn-toggle v-model="configStore.camera.type" color="primary" mandatory
                class="mb-8 w-100 justify-center">
    <v-btn value="perspective">Perspective</v-btn>
    <v-btn value="orthographic">Orthographic</v-btn>
  </v-btn-toggle>
  <v-expansion-panels>
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
        <g-align-labels label-width="4.5rem">
          <v-slider v-model="configStore.lights.directional1Intensity" label="Intensity" density="compact"
                    min="0" max="3" step="0.1" thumb-label />
          <v-slider v-model="alpha1" label="Around X" density="compact"
                    min="-180" max="180" step="1" thumb-label />
          <v-slider v-model="beta1" label="Along X" density="compact"
                    min="-90" max="90" step="1" thumb-label />
        </g-align-labels>
        <v-label text="Directional light 2" class="mb-2 no-select" />
        <v-color-picker v-model="configStore.lights.directional2Color"
                        :modes="['rgb', 'hsl', 'hex']" elevation="0" />
        <g-align-labels label-width="4.5rem">
          <v-slider v-model="configStore.lights.directional2Intensity" label="Intensity" density="compact"
                    min="0" max="3" step="0.1" thumb-label />
          <v-slider v-model="alpha2" label="Around Y" density="compact"
                    min="-180" max="180" step="1" thumb-label />
          <v-slider v-model="beta2" label="Along Y" density="compact"
                    min="-90" max="90" step="1" thumb-label />
        </g-align-labels>
        <v-label text="Directional light 3" class="mb-2 no-select" />
        <v-color-picker v-model="configStore.lights.directional3Color"
                        :modes="['rgb', 'hsl', 'hex']" elevation="0" />
        <g-align-labels label-width="4.5rem">
          <v-slider v-model="configStore.lights.directional3Intensity" label="Intensity" density="compact"
                    min="0" max="3" step="0.1" thumb-label />
          <v-slider v-model="alpha3" label="Around Z" density="compact"
                    min="-180" max="180" step="1" thumb-label />
          <v-slider v-model="beta3" label="Along Z" density="compact"
                    min="-90" max="90" step="1" thumb-label />
        </g-align-labels>
      </v-expansion-panel-text>
    </v-expansion-panel>
    <v-expansion-panel>
      <v-expansion-panel-title>
        Helper objects
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-switch v-model="configStore.helpers.showAxis" color="primary"
                  label="Show axis" density="compact" class="mt-3" />
        <g-align-labels label-width="5rem" class="ml-n4 mt-n5">
          <v-slider v-model="configStore.helpers.axisLength" label="Axis length" density="compact"
                    min="0.5" max="20" step="0.5" thumb-label />
        </g-align-labels>
        <v-switch v-model="configStore.helpers.showGridXZ" color="primary"
                  label="Show grid XZ" density="compact" class="mt-n5" />
        <v-switch v-model="configStore.helpers.showGridXY" color="primary"
                  label="Show grid XY" density="compact" class="mt-n5" />
        <v-switch v-model="configStore.helpers.showGridYZ" color="primary"
                  label="Show grid YZ" density="compact" class="mt-n5" />
        <g-align-labels label-width="5rem" class="ml-n4 mt-n5">
          <v-slider v-model="configStore.helpers.gridSize" label="Grid side" density="compact"
                    min="2" max="40" step="2" thumb-label />
        </g-align-labels>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</v-container>
</template>
