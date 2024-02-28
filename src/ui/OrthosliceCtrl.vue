<script setup lang="ts">
/**
 * @component
 * Controls for the orthoslice.
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";

// > Properties
const pr = defineProps<{

    /** Its own module id */
    id: string;
}>();

const tickLabels: Record<number, string> = {0: "X", 1: "Y", 2: "Z"};

/** Formats that could be loaded */
const colormaps = ["rainbow", "cooltowarm", "blackbody", "grayscale"];

const dataset = ref(0);
const axis = ref(0);
const plane = ref(0);
const showOrthoslice = ref(false);
const maxDataset = ref(0);
const maxPlane = ref(0);
const colormapName = ref("rainbow");


sb.getUiParams(pr.id, (params: UiParams) => {
    showOrthoslice.value = params.showOrthoslice as boolean ?? false;
    dataset.value = params.dataset as number ?? 0;
    axis.value = params.axis as number ?? 0;
    plane.value = params.plane as number ?? 0;
    maxDataset.value = params.maxDataset as number ?? 0;
    maxPlane.value = params.maxPlane as number ?? 0;
    colormapName.value = params.colormapName as string ?? "rainbow";
});
watchEffect(() => {
    sb.setUiParams(pr.id, {
        showOrthoslice: showOrthoslice.value,
        dataset: dataset.value,
        axis: axis.value,
        plane: plane.value,
        colormapName: colormapName.value
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showOrthoslice" color="primary" label="Show orthoslice" density="compact" class="mt-2 ml-4" />
  <v-label :text="`Dataset (${dataset})`" class="ml-2 mt-1" />
  <v-slider v-model="dataset" min="0" :max="maxDataset" step="1" :disabled="maxDataset === 0" class="ml-4 mt-1" />
  <v-label text="Axis" class="ml-2 mt-1" />
  <v-slider v-model="axis" :ticks="tickLabels" min="0" max="2" step="1"
            show-ticks="always" tick-size="5" class="ml-4 mt-1" />
  <v-label :text="`Plane (${plane})`" class="ml-2 mt-3" />
  <v-slider v-model="plane" min="0" :max="maxPlane" step="1" class="ml-4 mt-1" />

  <v-row class="mt-6 mb-2">
    <v-menu open-on-hover>
      <template #activator="{ props }">
        <v-btn class="w-25 ml-3" size="small" color="primary" v-bind="props">
          Colormap
        </v-btn>
      </template>
      <v-list>
        <v-list-item v-for="colormap in colormaps" :key="colormap">
          <v-list-item-title style="cursor: pointer" @click="colormapName = colormap">{{ colormap }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <v-label class="underlined-label">{{ colormapName }}</v-label>
  </v-row>

</v-container>
</template>


<style scoped>

.underlined-label {
  margin-left: 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), var(--v-border-opacity));
  width: 62%
}
</style>
