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
    label:  string;
    atomZi: number;
    atomZj: number;
    scale:  number;
}

const minBondingDistance  = ref(0.64);
const maxBondingDistance  = ref(4.50);
const bondScale           = ref(1.10);
const maxHBondingDistance = ref(3.00);
const maxHValenceAngle    = ref(30);
const enableComputeBonds  = ref(true);
const perPairScale        = ref(false);
const perPairData         = ref<PairData[]>([]);
const showScale           = ref<number[]>([]);
const enlargementKind     = ref("none");

sb.getUiParams(props.id, (params: UiParams) => {
    minBondingDistance.value  = params.minBondingDistance as number ?? 0.64;
    maxBondingDistance.value  = params.maxBondingDistance as number ?? 4.50;
    maxHBondingDistance.value = params.maxHBondingDistance as number ?? 3.00;
    maxHValenceAngle.value    = params.maxHValenceAngle as number ?? 30;
    enableComputeBonds.value  = params.enableComputeBonds as boolean ?? true;
    bondScale.value      		  = params.bondScale as number ?? 1.1;
    perPairScale.value        = params.perPairScale as boolean ?? false;
    enlargementKind.value     = params.enlargementKind as string ?? "none";

    perPairData.value.length = 0;
    const pairData = JSON.parse(params.perPairData as string ?? "[]") as PairData[];
    for(const item of pairData) {
        perPairData.value.push(item);
        showScale.value.push(item.scale);
    }
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
        enlargementKind:     enlargementKind.value
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
    let i = 0;
    for(const item of perPairData.value) {
        item.scale = 1.1;
        showScale.value[i] = 1.1;
        ++i;
    }
};

</script>


<template>
<v-container class="container">

  <v-switch v-model="enableComputeBonds" color="primary"
            label="Enable compute bonds" density="compact" class="mt-4 ml-2" />

  <g-debounced-slider v-slot="{value}" v-model="minBondingDistance" :min="0.6" :max="1" :step="0.01"
                      class="ml-2 mb-2 mt-1">
    <v-label :text="`Bonding min distance (${value.toFixed(2)})`" />
  </g-debounced-slider>
  <g-debounced-slider v-slot="{value}" v-model="maxBondingDistance" :min="2.0" :max="5.0" :step="0.01"
                      class="ml-2 mb-2">
    <v-label :text="`Bonding max distance (${value.toFixed(2)})`" />
  </g-debounced-slider>
  <g-debounced-slider v-slot="{value}" v-model="maxHBondingDistance" :min="2.5" :max="4.0" :step="0.01"
                      class="ml-2 mb-2">
    <v-label :text="`H Bonding max distance (${value.toFixed(2)})`" />
  </g-debounced-slider>
  <g-debounced-slider v-slot="{value}" v-model="maxHValenceAngle" :min="0" :max="45" :step="1" class="ml-2 mb-4">
    <v-label :text="`H Bonding max valence angle (${value.toFixed(2)})`" />
  </g-debounced-slider>
  <v-label class="ml-2">Sum of covalent radii multiplier</v-label>
  <v-switch v-model="perPairScale" color="primary" :disabled="perPairData.length < 2"
            label="Multiplier per atom pair" density="compact" class="ml-2 mt-2" />
  <v-container v-if="perPairScale" class="pa-0">
    <v-table class="px-2 py-1">
      <tr v-for="(item, idx) of perPairData" :key="item.label">
        <td style="width: 4rem">{{ item.label }}</td>
        <td><g-slider-with-steppers v-model="item.scale" v-model:raw="showScale[idx]"
                                    :label="`(${showScale[idx].toFixed(2)})`" label-width="3rem"
                                    :min="0.5" :max="2.0" :step="0.01" class="mr-0"/></td>
      </tr>
    </v-table>
  </v-container>
  <v-container v-else class="pa-0">
    <g-debounced-slider v-slot="{value}" v-model="bondScale" :min="0.5" :max="2.0" :step="0.01" class="ml-2">
      <v-label :text="`For all atom pairs (${value.toFixed(2)})`" />
    </g-debounced-slider>
  </v-container>
  <v-label class="ml-2 mb-2">Add bonded atoms outside unit cell</v-label>
  <v-btn-toggle v-model="enlargementKind" color="primary" class="mb-6 ml-2">
    <v-btn value="none">None</v-btn>
    <v-btn value="outside">Neighbors</v-btn>
    <v-btn value="connected">Connected</v-btn>
  </v-btn-toggle>

  <v-btn block class="mt-4" @click="resetSliders">
    <template #append>
      <v-icon :icon="mdiRestore" size="x-large" />
    </template>
    Reset
  </v-btn>

</v-container>
</template>

<style>
/* stylelint-disable selector-class-pattern */
.v-table__wrapper {
  overflow-y: hidden
}
</style>
