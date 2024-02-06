<script setup lang="ts">
/**
 * @component
 * Controls for the polyhedra visualizer.
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import AlignLabels from "@/widgets/AlignLabels.vue";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

const bypassComputation = ref(false);
const ignoreInputSymmetries = ref(false);
const tolS = ref(0.25);
const tolT = ref(0.25);
const tolG = ref(0.10);
const errorMessage = ref("");

sb.getUiParams(props.id, (params: UiParams) => {
    bypassComputation.value = params.bypassComputation as boolean ?? false;
    ignoreInputSymmetries.value = params.ignoreInputSymmetries as boolean ?? false;
    tolS.value = params.tolS as number ?? 0.25;
    tolT.value = params.tolT as number ?? 0.25;
    tolG.value = params.tolG as number ?? 0.10;
    errorMessage.value = params.errorMessage as string ?? "";
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        bypassComputation: bypassComputation.value,
        ignoreInputSymmetries: ignoreInputSymmetries.value,
        tolS: tolS.value,
        tolT: tolT.value,
        tolG: tolG.value
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="bypassComputation" color="primary"
            label="Disable computation" density="compact" class="mt-2 ml-4" />
  <v-switch v-model="ignoreInputSymmetries" color="primary"
            label="Ignore input symmetries" density="compact" class="mt-n5 ml-4" />
  <v-label class="mb-2 ml-2">Tolerances:</v-label>
  <align-labels label-width="3.5rem">
    <v-slider v-model="tolS" :label="`S (${tolS.toFixed(2)})`" density="compact"
                min="0.01" max="1" step="0.01" thumb-label />
    <v-slider v-model="tolT" :label="`T (${tolT.toFixed(2)})`" density="compact"
                min="0.01" max="1" step="0.01" thumb-label />
    <v-slider v-model="tolG" :label="`G (${tolG.toFixed(2)})`" density="compact"
                min="0.01" max="1" step="0.01" thumb-label />
  </align-labels>
  <v-alert v-if="errorMessage !== ''" title="Error"
           :text="errorMessage" type="error" density="compact" class="mt-4"
           style="cursor: pointer;" @click="errorMessage=''" />
</v-container>
</template>
