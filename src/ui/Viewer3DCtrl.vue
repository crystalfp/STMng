<script setup lang="ts">
/**
 * @component
 * Controls for the viewer.
 */

import {ref, watchEffect} from "vue";
import {useConfigStore} from "@/stores/configStore";
import AlignLabels from "@/widgets/AlignLabels.vue";

// > Access the store
const configStore = useConfigStore();

// > First directional light
const alpha1 = ref(0);  // Around X on YZ plane
const beta1 = ref(0);   // Angle with X axis

watchEffect(() => {
    const alphaRad = alpha1.value * Math.PI / 180;
    const betaRad  = beta1.value * Math.PI / 180;
    const lenYZ = Math.sin(betaRad);
    configStore.lights.directional1Position[0] = Math.cos(betaRad);
    configStore.lights.directional1Position[1] = lenYZ*Math.cos(alphaRad);
    configStore.lights.directional1Position[2] = -lenYZ*Math.sin(alphaRad);
});

// > Second directional light
const alpha2 = ref(0);
const beta2 = ref(0);

watchEffect(() => {
    const alphaRad = alpha2.value * Math.PI / 180;
    const betaRad  = beta2.value * Math.PI / 180;
    const lenXZ = Math.sin(betaRad);
    configStore.lights.directional2Position[0] = lenXZ*Math.sin(alphaRad);
    configStore.lights.directional2Position[1] = Math.cos(betaRad);
    configStore.lights.directional2Position[2] = lenXZ*Math.cos(alphaRad);
});

// > Third directional light
const alpha3 = ref(0);
const beta3 = ref(0);

watchEffect(() => {
    const alphaRad = alpha3.value * Math.PI / 180;
    const betaRad  = beta3.value * Math.PI / 180;
    const lenXY = Math.sin(betaRad);
    configStore.lights.directional3Position[0] = lenXY*Math.cos(alphaRad);
    configStore.lights.directional3Position[1] = lenXY*Math.sin(alphaRad);
    configStore.lights.directional3Position[2] = Math.cos(betaRad);
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="configStore.camera.perspective" color="primary" label="Perspective camera" class="ml-1" />
  <v-btn block class="mb-3" @click="configStore.control.reset = true">Reset camera</v-btn>
  <v-expansion-panels>
    <v-expansion-panel>
      <v-expansion-panel-title>
        Scene
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-label text="Background color" />
        <v-color-picker v-model="configStore.scene.background"
                        :modes="['rgb', 'hsl', 'hex']" elevation="0" />
      </v-expansion-panel-text>
    </v-expansion-panel>
    <v-expansion-panel>
      <v-expansion-panel-title>
        Ambient light
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-label text="Light color" />
        <v-color-picker v-model="configStore.lights.ambientColor"
                        :modes="['rgb', 'hsl', 'hex']" elevation="0" />
        <v-slider v-model="configStore.lights.ambientIntensity" label="Intensity" density="comfortable"
                  min="0" max="3" step="0.1" />
      </v-expansion-panel-text>
    </v-expansion-panel>
    <v-expansion-panel>
      <v-expansion-panel-title>
        Directional lights
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-label text="Directional light 1" />
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
        <v-label text="Directional light 2" />
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
        <v-label text="Directional light 3" />
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
  </v-expansion-panels>
</v-container>
</template>
