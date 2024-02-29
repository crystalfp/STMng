<script setup lang="ts">

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {useMessageStore} from "@/stores/messageStore";

// > Properties
const pr = defineProps<{

    /** Its own module id */
    id: string;
}>();

// > Access the messages store
const messageStore = useMessageStore();

// > Get and set ui parameters from the switchboard
// const inputSymmetry = ref("");

const enableFindSymmetries = ref(true);
const ignoreInputSymmetries = ref(false);
const tolS = ref(0.25);
const tolT = ref(0.25);
const tolG = ref(0.10);

const finalSymmetry = ref("");
const fillUnitCell = ref(true);
const enableApplySymmetries = ref(true);

sb.getUiParams(pr.id, (params: UiParams) => {

    // inputSymmetry.value = params.inputSymmetry as string ?? "";

    enableFindSymmetries.value = params.enableFindSymmetries as boolean ?? true;
    ignoreInputSymmetries.value = params.ignoreInputSymmetries as boolean ?? false;
    tolS.value = params.tolS as number ?? 0.25;
    tolT.value = params.tolT as number ?? 0.25;
    tolG.value = params.tolG as number ?? 0.10;

    finalSymmetry.value = params.finalSymmetry as string ?? "";
    fillUnitCell.value  = params.fillUnitCell as boolean ?? true;
    enableApplySymmetries.value = params.enableApplySymmetries as boolean ?? true;
});

watchEffect(() => {
    sb.setUiParams(pr.id, {
        enableFindSymmetries: enableFindSymmetries.value,
        ignoreInputSymmetries: ignoreInputSymmetries.value,
        tolS: tolS.value,
        tolT: tolT.value,
        tolG: tolG.value,

        fillUnitCell: fillUnitCell.value,
        enableApplySymmetries: enableApplySymmetries.value,
    });
});

</script>


<template>
<v-container class="container">
  <!-- <v-label class="text-h5 w-100 justify-center mt-4">Input symmetry</v-label>

  <v-label :text="inputSymmetry" class="mt-4 w-100 justify-center show-symmetry" />

  <v-divider :thickness="8" class="mt-3" /> -->

  <v-label class="text-h5 w-100 justify-center mt-3">Find symmetries</v-label>
  <v-switch v-model="enableFindSymmetries" color="primary"
            label="Enable find symmetries" density="compact" class="mt-6 ml-4" />
  <v-switch v-model="ignoreInputSymmetries" color="primary"
            label="Ignore input symmetries" density="compact" class="mt-n5 ml-4" />
  <v-label class="mb-2 ml-2">Tolerances:</v-label>
  <g-align-labels label-width="3.5rem">
    <v-slider v-model="tolS" :label="`S (${tolS.toFixed(2)})`" density="compact"
                min="0.01" max="1" step="0.01" thumb-label />
    <v-slider v-model="tolT" :label="`T (${tolT.toFixed(2)})`" density="compact"
                min="0.01" max="1" step="0.01" thumb-label />
    <v-slider v-model="tolG" :label="`G (${tolG.toFixed(2)})`" density="compact"
                min="0.01" max="1" step="0.01" thumb-label />
  </g-align-labels>

  <v-divider :thickness="8" />
  <v-label class="text-h5 w-100 justify-center mt-3">Apply symmetries</v-label>

  <v-label :text="finalSymmetry" class="mt-4 w-100 justify-center show-symmetry" />

  <v-switch v-model="enableApplySymmetries" color="primary"
            label="Enable apply symmetries" class="ml-4 mt-3" />
  <v-switch v-model="fillUnitCell" color="primary" label="Fill unit cell" class="ml-4 mt-n5" />

  <v-alert v-if="messageStore.symmetries.message !== ''" title="Error"
           :text="messageStore.symmetries.message" type="error" density="compact" color="red"
           class="cursor-pointer" @click="messageStore.symmetries.message=''" />
</v-container>
</template>

<style scoped>
.show-symmetry {
  overflow-wrap: break-word;
  white-space: break-spaces;
  font-family: monospace;
}
</style>
