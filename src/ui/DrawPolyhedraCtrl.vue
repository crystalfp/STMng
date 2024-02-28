<script setup lang="ts">
/**
 * @component
 * Controls for the polyhedra visualizer.
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

const showPolyhedra = ref(true);
const surfaceColor = ref("#FFFFFF80");
const labelKind = ref("symbol");
const atomsSelector = ref("");

sb.getUiParams(props.id, (params: UiParams) => {
    showPolyhedra.value = params.showPolyhedra as boolean ?? false;
    surfaceColor.value = params.surfaceColor as string ?? "#FFFFFF80";
    labelKind.value = params.labelKind as string ?? "symbol";
    atomsSelector.value = params.atomsSelector as string ?? "";
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        showPolyhedra: showPolyhedra.value,
        surfaceColor: surfaceColor.value,
        labelKind: labelKind.value,
        atomsSelector: atomsSelector.value
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showPolyhedra" color="primary" label="Show polyhedra" density="compact" class="mt-2 ml-4" />
  <v-label text="Select central atoms by" class="mb-3 ml-2" /><br>
  <v-btn-toggle v-model="labelKind" color="primary" class="mb-6 ml-2">
    <v-btn value="symbol">Symbol</v-btn>
    <v-btn value="label">Label</v-btn>
    <v-btn value="index">Index</v-btn>
  </v-btn-toggle>
  <v-text-field v-model="atomsSelector" label="Central atoms selector" class="mb-6 ml-2"
                placeholder="Space separated list"
                variant="solo-filled" hide-details="auto" clearable />
  <g-color-selector v-model="surfaceColor" label="Surface color" :transparency="true" />
</v-container>
</template>
