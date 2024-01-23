<script setup lang="ts">

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

const showAxis   = ref(false);
const showGridXZ = ref(false);
const showGridXY = ref(false);
const showGridYZ = ref(false);
const gridSize   = ref(10);

sb.getUiParams(props.id, (params: UiParams) => {
    showAxis.value   = params.showAxis as boolean ?? false;
    showGridXZ.value = params.showGridXZ as boolean ?? false;
    showGridXY.value = params.showGridXY as boolean ?? false;
    showGridYZ.value = params.showGridYZ as boolean ?? false;
    gridSize.value   = params.gridSize as number ?? 10;
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        showAxis: showAxis.value,
        showGridXZ: showGridXZ.value,
        showGridXY: showGridXY.value,
        showGridYZ: showGridYZ.value,
        gridSize: gridSize.value
    });
});
</script>


<template>
<v-container class="container">
  <v-switch v-model="showAxis" color="primary" label="Show axis" density="compact" class="mt-2 ml-3" />
  <v-switch v-model="showGridXZ" color="primary" label="Show grid XZ" density="compact" class="ml-3 mt-n5" />
  <v-switch v-model="showGridXY" color="primary" label="Show grid XY" density="compact" class="ml-3 mt-n5" />
  <v-switch v-model="showGridYZ" color="primary" label="Show grid YZ" density="compact" class="ml-3 mt-n5" />
  <v-slider v-model="gridSize" label="Grid side" density="compact" min="2" max="40" step="2" thumb-label />
</v-container>
</template>
