<script setup lang="ts">

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {mdiRestore} from "@mdi/js";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

const minBondingDistance  = ref(0.64);
const maxBondingDistance  = ref(4.50);
const bondScale           = ref(1.10);
const maxHBondingDistance = ref(3.00);
const maxHValenceAngle    = ref(30);
const enableComputeBonds  = ref(true);

sb.getUiParams(props.id, (params: UiParams) => {
    minBondingDistance.value  = params.minBondingDistance as number ?? 0.64;
    maxBondingDistance.value  = params.maxBondingDistance as number ?? 4.50;
    maxHBondingDistance.value = params.maxHBondingDistance as number ?? 3.00;
    maxHValenceAngle.value    = params.maxHValenceAngle as number ?? 30;
    enableComputeBonds.value  = params.enableComputeBonds as boolean ?? true;
    bondScale.value      		  = params.bondScale as number ?? 1.1;
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        minBondingDistance:  minBondingDistance.value,
        maxBondingDistance:  maxBondingDistance.value,
        maxHBondingDistance: maxHBondingDistance.value,
        maxHValenceAngle:    maxHValenceAngle.value,
        enableComputeBonds:  enableComputeBonds.value,
        bondScale:           bondScale.value,
    });
});

/**
 * Reset sliders to default values
 */
const resetSliders = (): void => {
    minBondingDistance.value  = 0.64;
    maxBondingDistance.value  = 4.50;
    maxHBondingDistance.value = 3.00;
    maxHValenceAngle.value    = 30;
    bondScale.value           = 1.1;
};

</script>


<template>
<v-container class="container">

  <v-switch v-model="enableComputeBonds" color="primary"
            label="Enable compute bonds" density="compact" class="mt-6 ml-4" />

  <v-label :text="`Bonding min distance (${minBondingDistance.toFixed(2)})`" class="ml-2 mt-1" />
  <v-slider v-model="minBondingDistance" density="compact" min="0.6" max="1" step="0.01" />
  <v-label :text="`Bonding max distance (${maxBondingDistance.toFixed(2)})`" class="ml-2" />
  <v-slider v-model="maxBondingDistance" density="compact" min="2.0" max="5.0" step="0.01" />
  <v-label :text="`Bonding scale (${bondScale.toFixed(2)})`" class="ml-2" />
  <v-slider v-model="bondScale" density="compact" min="0.5" max="2.0" step="0.1" />
  <v-label :text="`H Bonding max distance (${maxHBondingDistance.toFixed(2)})`" class="ml-2" />
  <v-slider v-model="maxHBondingDistance" density="compact" min="2.5" max="4.0" step="0.01" />
  <v-label :text="`H Bonding max valence angle (${maxHValenceAngle.toFixed(2)})`" class="ml-2" />
  <v-slider v-model="maxHValenceAngle" density="compact" min="0" max="45" step="1" />
  <v-btn class="mt-4 ml-2" @click="resetSliders">
    <template #append>
      <v-icon :icon="mdiRestore" size="x-large" />
    </template>
    Reset
  </v-btn>

</v-container>
</template>
