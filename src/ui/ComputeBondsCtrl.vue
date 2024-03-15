<script setup lang="ts">
/**
 * @component
 * Controls for bonds computation.
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {mdiRestore} from "@mdi/js";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

interface PairData {
    label: string;
    atomZi: number;
    atomZj: number;
    scale: number;
}

const minBondingDistance  = ref(0.64);
const maxBondingDistance  = ref(4.50);
const bondScale           = ref(1.10);
const maxHBondingDistance = ref(3.00);
const maxHValenceAngle    = ref(30);
const enableComputeBonds  = ref(true);
const perPairScale        = ref(false);
const perPairData         = ref<PairData[]>([]);
const enlargeCell         = ref(false);

sb.getUiParams(props.id, (params: UiParams) => {
    minBondingDistance.value  = params.minBondingDistance as number ?? 0.64;
    maxBondingDistance.value  = params.maxBondingDistance as number ?? 4.50;
    maxHBondingDistance.value = params.maxHBondingDistance as number ?? 3.00;
    maxHValenceAngle.value    = params.maxHValenceAngle as number ?? 30;
    enableComputeBonds.value  = params.enableComputeBonds as boolean ?? true;
    bondScale.value      		  = params.bondScale as number ?? 1.1;
    perPairScale.value        = params.perPairScale as boolean ?? false;
    enlargeCell.value         = params.enlargeCell as boolean ?? false;

    perPairData.value.length = 0;
    const pairData = JSON.parse(params.perPairData as string ?? "[]") as PairData[];
    for(const item of pairData) perPairData.value.push(item);
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        minBondingDistance:  minBondingDistance.value,
        maxBondingDistance:  maxBondingDistance.value,
        maxHBondingDistance: maxHBondingDistance.value,
        maxHValenceAngle:    maxHValenceAngle.value,
        enableComputeBonds:  enableComputeBonds.value,
        bondScale:           bondScale.value,
        perPairScale:        perPairScale.value,
        perPairData:         JSON.stringify(perPairData.value),
        enlargeCell:         enlargeCell.value
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
    for(const item of perPairData.value) item.scale = 1.1;
};

</script>


<template>
<v-container class="container">

  <v-switch v-model="enableComputeBonds" color="primary"
            label="Enable compute bonds" density="compact" class="mt-4 ml-2" />

  <v-label :text="`Bonding min distance (${minBondingDistance.toFixed(2)})`" class="ml-0 mt-1" />
  <v-slider v-model="minBondingDistance" density="compact" min="0.6" max="1" step="0.01" class="ml-0" />
  <v-label :text="`Bonding max distance (${maxBondingDistance.toFixed(2)})`" class="ml-0" />
  <v-slider v-model="maxBondingDistance" density="compact" min="2.0" max="5.0" step="0.01" class="ml-0" />
  <v-label :text="`H Bonding max distance (${maxHBondingDistance.toFixed(2)})`" class="ml-0" />
  <v-slider v-model="maxHBondingDistance" density="compact" min="2.5" max="4.0" step="0.01" class="ml-0" />
  <v-label :text="`H Bonding max valence angle (${maxHValenceAngle.toFixed(2)})`" class="ml-0" />
  <v-slider v-model="maxHValenceAngle" density="compact" min="0" max="45" step="1" class="ml-0" />
  <v-label>Sum covalent radii multiplier</v-label>
  <v-switch v-model="perPairScale" color="primary"
            label="Multiplier per atom pair" density="compact" class="ml-2 mt-2" />
  <v-container v-if="perPairScale" class="pa-0">
    <v-table density="comfortable">
      <tr v-for="item of perPairData" :key="item.label" style="height: 2.3rem;">
        <td style="width: 3.7rem" class="ml-2 pl-1">{{ item.label }}</td>
        <td style="width: 3rem">{{ `(${item.scale.toFixed(2)})` }}</td>
        <td><v-slider v-model="item.scale" min="0.5" max="2.0" step="0.01" hide-details /></td>
      </tr>
    </v-table>
  </v-container>
  <v-container v-else class="pa-0">
    <v-label :text="`For all atom pairs (${bondScale.toFixed(2)})`" class="ml-0" />
    <v-slider v-model="bondScale" density="compact" min="0.5" max="2.0" step="0.01" class="ml-0" />
  </v-container>
  <v-switch v-model="enlargeCell" color="primary"
            label="Add bonded atoms outside unit cell" density="compact" class="mt-2 ml-2" />
  <v-btn block class="mt-4" @click="resetSliders">
    <template #append>
      <v-icon :icon="mdiRestore" size="x-large" />
    </template>
    Reset
  </v-btn>

</v-container>
</template>
