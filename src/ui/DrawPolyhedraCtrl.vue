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

sb.getUiParams(props.id, (params: UiParams) => {
    showPolyhedra.value = params.showPolyhedra as boolean ?? false;
    surfaceColor.value = params.surfaceColor as string ?? "#FFFFFF80";
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        showPolyhedra: showPolyhedra.value,
        surfaceColor: surfaceColor.value
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showPolyhedra" color="primary" label="Show polyhedra" density="compact" class="mt-2 ml-4" />
  <g-color-selector v-model="surfaceColor" label="Surface color" :transparency="true" />
</v-container>
</template>
