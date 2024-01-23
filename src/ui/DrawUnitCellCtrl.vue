<script setup lang="ts">
/**
 * @component
 * Controls for the structure data reader.
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {mdiRectangle} from "@mdi/js";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

const showUnitCell = ref(true);
const lineColor = ref("#0000FF");
const dashedLine = ref(false);
const lineColorShow = ref(false);

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
  <v-switch v-model="showUnitCell" color="primary" label="Show Unit Cell" class="mt-4 ml-2" />
  <v-switch v-model="dashedLine" color="primary" label="Dashed lines" class="ml-2 mt-n5" />
  <v-btn class="mb-6" @click="lineColorShow = !lineColorShow">
    <template #append>
      <v-icon :icon="mdiRectangle" :color="lineColor" size="x-large" />
    </template>
    Line color
  </v-btn>
  <v-color-picker v-if="lineColorShow" v-model="lineColor" :modes="['rgb', 'hsl', 'hex']" elevation="0" />
</v-container>
</template>
