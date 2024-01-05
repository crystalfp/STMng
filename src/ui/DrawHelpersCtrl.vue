<script setup lang="ts">

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

const showAxis = ref(false);
const showGrid = ref(false);
const gridSize = ref(10);

sb.getUiParams(props.id, (params: UiParams) => {
    showAxis.value = params.showAxis as boolean ?? false;
    showGrid.value = params.showGrid as boolean ?? false;
    gridSize.value = params.gridSize as number ?? 10;
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        showAxis: showAxis.value,
        showGrid: showGrid.value,
        gridSize: gridSize.value
    });
});
</script>


<template>
<v-container class="container">
  <v-switch v-model="showAxis" color="primary" label="Show axis" density="compact" class="mt-2 ml-3" />
  <v-switch v-model="showGrid" color="primary" label="Show grid" density="compact" class="ml-3" />
  <v-slider v-model="gridSize" label="Grid side" density="compact" min="2" max="40" step="2" thumb-label />
</v-container>
</template>
