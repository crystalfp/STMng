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
const colorByCenterAtom = ref(false);
const opacityByCenterAtom = ref(0.5);
const showOpacity = ref(0.5);

sb.getUiParams(props.id, (params: UiParams) => {
    showPolyhedra.value = params.showPolyhedra as boolean ?? false;
    surfaceColor.value = params.surfaceColor as string ?? "#FFFFFF80";
    labelKind.value = params.labelKind as string ?? "symbol";
    atomsSelector.value = params.atomsSelector as string ?? "";
	colorByCenterAtom.value = params.colorByCenterAtom as boolean ?? false;
    opacityByCenterAtom.value = params.opacityByCenterAtom as number ?? 0.5;
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        showPolyhedra: showPolyhedra.value,
        surfaceColor: surfaceColor.value,
        labelKind: labelKind.value,
        atomsSelector: atomsSelector.value,
        colorByCenterAtom: colorByCenterAtom.value,
        opacityByCenterAtom: opacityByCenterAtom.value
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showPolyhedra" color="primary" label="Show polyhedra" density="compact"
            class="mt-2 ml-4" />
  <v-switch v-model="colorByCenterAtom" color="primary" label="Color by center atom" density="compact"
            class="mt-n5 ml-4" />
  <g-atoms-selector v-model:kind="labelKind" v-model:selector="atomsSelector"
                    class="ml-2 mb-6"
                    title="Select central atoms by" placeholder="Central atoms selector" />
  <g-slider-with-steppers v-if="colorByCenterAtom" v-model="opacityByCenterAtom" v-model:raw="showOpacity"
                          :label="`Opacity (${showOpacity.toFixed(1)})`"
                          min="0" max="1" step="0.1" />
  <g-color-selector v-else v-model="surfaceColor" label="Surface color" :transparency="true" />
</v-container>
</template>
