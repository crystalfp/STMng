<script setup lang="ts">
/**
 * @component
 * Controls for the structure data reader.
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

const showUnitCell = ref(true);
const lineColor = ref("#0000FF");
const dashedLine = ref(false);

sb.getUiParams(props.id, (params: UiParams) => {
    showUnitCell.value = params.showUnitCell as boolean ?? true;
    lineColor.value = params.lineColor as string ?? "#0000FF";
    dashedLine.value = params.dashedLine as boolean ?? false;
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        showUnitCell: showUnitCell.value,
        lineColor: lineColor.value,
        dashedLine: dashedLine.value
    });
});
</script>


<template>
<v-container class="container">
  <v-switch v-model="showUnitCell" color="primary" label="Show Unit Cell" density="compact" class="mt-4 ml-2" />
  <v-switch v-model="dashedLine" color="primary" label="Dashed lines" density="compact" class="ml-2" />
  <v-label text="Line color" />
  <v-color-picker v-model="lineColor" :modes="['rgb', 'hsl', 'hex']" elevation="0" />
</v-container>
</template>
