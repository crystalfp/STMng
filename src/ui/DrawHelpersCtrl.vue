<script setup lang="ts">

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

const showAxis = ref(true);
const showGrid = ref(true);

sb.getUiParams(props.id, (params: UiParams) => {
    showAxis.value = params.showAxis as boolean ?? true;
    showGrid.value = params.showGrid as boolean ?? true;
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        showAxis: showAxis.value,
        showGrid: showGrid.value
    });
});
</script>


<template>
<v-container class="container">
  <v-switch v-model="showAxis" color="primary" label="Show axis" density="compact" class="mt-4" />
  <v-switch v-model="showGrid" color="primary" label="Show grid" density="compact" />
</v-container>
</template>
