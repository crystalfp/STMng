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

const ignoreInputSymmetries = ref(false);
const tolS = ref(0.25);
const tolT = ref(0.25);
const tolG = ref(0.10);

sb.getUiParams(props.id, (params: UiParams) => {
    ignoreInputSymmetries.value = params.ignoreInputSymmetries as boolean ?? false;
    tolS.value = params.tolS as number ?? 0.25;
    tolT.value = params.tolT as number ?? 0.25;
    tolG.value = params.tolG as number ?? 0.10;
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        ignoreInputSymmetries: ignoreInputSymmetries.value,
        tolS: tolS.value,
        tolT: tolT.value,
        tolG: tolG.value
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="ignoreInputSymmetries" color="primary"
            label="Ignore input symmetries" density="compact" class="mt-2 ml-4" />
  <v-label class="mb-2 ml-2">Tolerances:</v-label>
  <v-slider v-model="tolS" label="S" density="compact"
            min="0.01" max="1" step="0.01" thumb-label />
  <v-slider v-model="tolT" label="T" density="compact"
            min="0.01" max="1" step="0.01" thumb-label />
  <v-slider v-model="tolG" label="G" density="compact"
            min="0.01" max="1" step="0.01" thumb-label />
</v-container>
</template>

<style>
.v-slider__label {
  width: 1rem;
}
</style>
