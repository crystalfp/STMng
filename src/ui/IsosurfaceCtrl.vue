<script setup lang="ts">
/**
 * @component
 * Controls for bonds computation.
 */

import {ref, watchEffect, computed} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";

// > Properties
const properties = defineProps<{

    /** Its own module id */
    id: string;
}>();

const showIsosurface = ref(false);
const dataset = ref(0);
const maxDataset = ref(0);
const valueMin = ref(-10);
const valueMax = ref(10);
const isoValue = ref((valueMax.value+valueMin.value)/2);
const step = computed(() => {
    return (valueMax.value - valueMin.value)/100;
});
const colormapName = ref("rainbow");
const opacity = ref(1);

/** Available colormaps */
const colormaps = ["rainbow", "cooltowarm", "blackbody", "grayscale"];

const formatPrecision = 4;
const tenToN = Math.pow(10, formatPrecision);
const tenToMinusN = Math.pow(10, -formatPrecision);
const formatZero = `0.${"0".repeat(formatPrecision)}`;
const humanFormat = (x: number): string => {

    if(x === 0) return formatZero;
    if(x >= tenToN || x <= -tenToN) return x.toExponential(formatPrecision);
    if(x < tenToMinusN && x > -tenToMinusN) return x.toExponential(formatPrecision);
    return x.toPrecision(formatPrecision);
};

sb.getUiParams(properties.id, (params: UiParams) => {
    showIsosurface.value = params.showIsosurface as boolean ?? false;
    maxDataset.value = params.maxDataset as number ?? 0;
    dataset.value = params.dataset as number ?? 0;
    valueMin.value = params.valueMin as number ?? -10;
    valueMax.value = params.valueMax as number ?? 10;
    isoValue.value = params.isoValue as number ?? 0;
    colormapName.value = params.colormapName as string ?? "rainbow";
    opacity.value = params.opacity as number ?? 1;
});
watchEffect(() => {
    sb.setUiParams(properties.id, {
        showIsosurface: showIsosurface.value,
        dataset: dataset.value,
        isoValue: isoValue.value,
        colormapName: colormapName.value,
        opacity: opacity.value,
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showIsosurface" color="primary" label="Show isosurface"
            density="compact" class="mt-4 ml-4" />
  <v-label :text="`Dataset (${dataset})`" class="ml-2" />
  <v-slider v-model="dataset" min="0" :max="maxDataset" step="1" :disabled="maxDataset === 0" class="ml-4 mt-1" />
  <v-label :text="`Isosurface value (${humanFormat(isoValue)})`" class="ml-2" />
  <v-slider v-model="isoValue" :step="step" :min="valueMin" :max="valueMax" class="ml-4 mt-1" />

  <v-row class="mt-3 mb-2">
    <v-menu open-on-hover>
      <template #activator="{ props }">
        <v-btn class="w-25 ml-6" size="small" color="primary" v-bind="props">
          Colormap
        </v-btn>
      </template>
      <v-list>
        <v-list-item v-for="colormap in colormaps" :key="colormap">
          <v-list-item-title style="cursor: pointer" @click="colormapName = colormap">
            {{ colormap }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <v-label class="underlined-label">{{ colormapName }}</v-label>
  </v-row>
  <v-label :text="`Opacity (${opacity.toFixed(1)})`" class="ml-2 mt-6" />
  <v-slider v-model="opacity" :step="0.1" :min="0" :max="1" class="ml-4 mt-1" />
</v-container>
</template>
