<script setup lang="ts">
/**
 * @component
 * Controls for the orthoslice.
 */

import {ref, watchEffect, computed} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {humanFormat} from "@/services/HumanFormat";

// > Properties
const pr = defineProps<{

    /** Its own module id */
    id: string;
}>();

const tickLabels: Record<number, string> = {0: "X", 1: "Y", 2: "Z"};

/** Available colormaps */
const colormaps = ["rainbow", "cooltowarm", "blackbody", "grayscale"];

const dataset = ref(0);
const axis = ref(0);
const plane = ref(0);
const showOrthoslice = ref(false);
const maxDataset = ref(0);
const maxPlane = ref(0);
const colormapName = ref("rainbow");
const limits = ref<number[]>([]);
const limitLow = ref(-10);
const limitHigh = ref(10);
const valueMin = ref(-10);
const valueMax = ref(10);
const useColorClasses = ref(false);
const colorClasses = ref(5);
const step = computed(() => (valueMax.value - valueMin.value)/100);

const showIsolines = ref(false);
const colorIsolines = ref(false);
const isoValue = ref((valueMax.value+valueMin.value)/2);

sb.getUiParams(pr.id, (params: UiParams) => {
    showOrthoslice.value = params.showOrthoslice as boolean ?? false;
    dataset.value = params.dataset as number ?? 0;
    axis.value = params.axis as number ?? 0;
    plane.value = params.plane as number ?? 0;
    maxDataset.value = params.maxDataset as number ?? 0;
    maxPlane.value = params.maxPlane as number ?? 0;
    colormapName.value = params.colormapName as string ?? "rainbow";
    limitLow.value = params.limitLow as number ?? -10;
    limitHigh.value = params.limitHigh as number ?? 10;
    valueMin.value = params.valueMin as number ?? -10;
    valueMax.value = params.valueMax as number ?? 10;
    useColorClasses.value = params.useColorClasses as boolean ?? false;
    colorClasses.value = params.colorClasses as number ?? 5;
    showIsolines.value = params.showIsolines as boolean ?? false;
    isoValue.value = params.isoValue as number ?? 0;
    colorIsolines.value = params.colorIsolines as boolean ?? false;

    if(isoValue.value > limitHigh.value) isoValue.value = limitHigh.value;
    if(isoValue.value < limitLow.value)  isoValue.value = limitLow.value;

    limits.value[0] = limitLow.value;
    limits.value[1] = limitHigh.value;
});
watchEffect(() => {
    sb.setUiParams(pr.id, {
        showOrthoslice: showOrthoslice.value,
        dataset: dataset.value,
        axis: axis.value,
        plane: plane.value,
        colormapName: colormapName.value,
        limitLow: limits.value[0],
        limitHigh: limits.value[1],
        colorClasses: colorClasses.value,
        useColorClasses: useColorClasses.value,
        showIsolines: showIsolines.value,
        isoValue: isoValue.value,
        colorIsolines: colorIsolines.value,
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showOrthoslice" color="primary" label="Show orthoslice" density="compact" class="mt-2 ml-3" />
  <v-label :text="`Dataset (${dataset})`" class="ml-2" />
  <v-slider v-model="dataset" min="0" :max="maxDataset" step="1" :disabled="maxDataset === 0" class="ml-4 mt-1" />
  <v-label text="Axis" class="ml-2" />
  <v-slider v-model="axis" :ticks="tickLabels" min="0" max="2" step="1"
            show-ticks="always" tick-size="5" class="ml-4 mt-1" />
  <g-debounced-slider v-slot="{value}" v-model="plane"
                      :step="1" :min="0" :max="maxPlane" class="ml-2 mt-1">
    <v-label :text="`Plane (${value})`" class="ml-0" />
  </g-debounced-slider>

  <v-label :text="`Values range (${humanFormat(limitLow)} – ${humanFormat(limitHigh)})`" class="ml-2" />
  <v-range-slider v-model="limits" strict :step="step" :min="valueMin" :max="valueMax"
                  color="primary" class="ml-4 mt-1 pr-2" />

  <v-switch v-model="useColorClasses" color="primary"
            label="Use discrete classes" density="compact" class="ml-3" />
  <g-debounced-slider v-slot="{value}" v-model="colorClasses" :step="1" :min="2" :max="20"
                      :disabled="!useColorClasses" class="ml-2 mt-1">
    <v-label :text="`Number classes (${value})`" />
  </g-debounced-slider>

  <v-row class="mt-3 mb-2">
    <v-menu open-on-hover>
      <template #activator="{props}">
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

  <v-switch v-model="showIsolines" color="primary" label="Show isolines"
            density="compact" class="mt-6 ml-4" />
  <v-switch v-model="colorIsolines" color="primary" label="Color isolines"
            density="compact" class="ml-4 mt-n5" />
  <g-debounced-slider v-slot="{value}" v-model="isoValue" :step="step" :min="valueMin"
                      :max="valueMax" :disabled="useColorClasses" class="ml-2 mt-1">
    <v-label :text="`Isoline value (${humanFormat(value)})`" />
  </g-debounced-slider>
</v-container>
</template>
