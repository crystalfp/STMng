<script setup lang="ts">
/**
 * @component
 * Controls for Isosurfaces computation.
 */

import {ref, watchEffect, computed} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {humanFormat} from "@/services/HumanFormat";

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
const step = computed(() => (valueMax.value - valueMin.value)/100);
const colormapName = ref("rainbow");
const opacity = ref(1);

const nestedIsosurfaces = ref(false);
const countIsosurfaces = ref(2);
const limits = ref<number[]>([]);
const limitLow = ref(-10);
const limitHigh = ref(10);
const limitColormap = ref(false);

/** Available colormaps */
const colormaps = ["rainbow", "cooltowarm", "blackbody", "grayscale"];

sb.getUiParams(properties.id, (params: UiParams) => {
    showIsosurface.value = params.showIsosurface as boolean ?? false;
    maxDataset.value = params.maxDataset as number ?? 0;
    dataset.value = params.dataset as number ?? 0;
    valueMin.value = params.valueMin as number ?? -10;
    valueMax.value = params.valueMax as number ?? 10;
    isoValue.value = params.isoValue as number ?? 0;
    colormapName.value = params.colormapName as string ?? "rainbow";
    opacity.value = params.opacity as number ?? 1;

    nestedIsosurfaces.value = params.nestedIsosurfaces as boolean ?? false;
    countIsosurfaces.value = params.countIsosurfaces as number ?? 2;
    limitLow.value = params.limitLow as number ?? -10;
    limitHigh.value = params.limitHigh as number ?? 10;
    limitColormap.value = params.limitColormap as boolean ?? false;

    limits.value[0] = limitLow.value;
    limits.value[1] = limitHigh.value;
});
watchEffect(() => {

    limitLow.value = limits.value[0];
    limitHigh.value = limits.value[1];

    sb.setUiParams(properties.id, {
        showIsosurface: showIsosurface.value,
        dataset: dataset.value,
        isoValue: isoValue.value,
        colormapName: colormapName.value,
        opacity: opacity.value,
        nestedIsosurfaces: nestedIsosurfaces.value,
        countIsosurfaces: countIsosurfaces.value,
        limitLow: limitLow.value,
        limitHigh: limitHigh.value,
        limitColormap: limitColormap.value,
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showIsosurface" color="primary" label="Show isosurface"
            density="compact" class="mt-4 ml-4" />
  <v-label :text="`Dataset (${dataset})`" class="ml-2" />
  <v-slider v-model="dataset" min="0" :max="maxDataset" step="1" :disabled="maxDataset === 0" class="ml-4 mt-1" />

  <v-switch v-model="nestedIsosurfaces" color="primary" label="Nested isosurfaces"
            density="compact" class="mt-1 ml-4" />

  <v-container v-if="nestedIsosurfaces" class="pa-0">
    <g-debounced-slider v-slot="{value}" v-model="countIsosurfaces"
                        :step="1" :min="2" :max="10" class="ml-2 mb-4">
      <v-label :text="`Number of isosurfaces (${value})`" />
    </g-debounced-slider>
    <g-debounced-range-slider v-slot="{values}" v-model="limits" :step="step" :min="valueMin" :max="valueMax"
                              class="ml-4 mt-1 pr-2">
      <v-label :text="`Values range (${humanFormat(values[0])} – ${humanFormat(values[1])})`" class="ml-2" />
    </g-debounced-range-slider>
    <v-switch v-model="limitColormap" color="primary" label="Limit colormap to range"
              density="compact" class="mt-1 ml-4" />
  </v-container>

  <v-container v-else class="pa-0">
    <g-debounced-slider v-slot="{value}" v-model="isoValue"
                        :step="step" :min="valueMin" :max="valueMax" class="ml-2 mt-1 mb-4">
      <v-label :text="`Isosurface value (${humanFormat(value)})`" />
    </g-debounced-slider>
  </v-container>

  <v-select v-model="colormapName" label="Colormap"
            :items="colormaps" class="mt-0 mx-2" density="compact" />

  <g-debounced-slider v-slot="{value}" v-model="opacity" :step="0.1" :min="0" :max="1" class="ml-2 mt-1">
    <v-label :text="`Opacity (${value.toFixed(1)})`" class="mt-2" />
  </g-debounced-slider>
</v-container>
</template>
