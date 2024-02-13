<script setup lang="ts">
/**
 * @component
 * Controls for the apply symmetries node.
 */

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
const symmetryGroup = ref("");
const fillUnitCell = ref(true);
const enableSymmetryComputation = ref(true);

sb.getUiParams(pr.id, (params: UiParams) => {

    symmetryGroup.value = params.symmetryGroup as string ?? "";
    fillUnitCell.value  = params.fillUnitCell as boolean ?? true;
    enableSymmetryComputation.value = params.enableSymmetryComputation as boolean ?? true;
});

watchEffect(() => {
    sb.setUiParams(pr.id, {
        fillUnitCell: fillUnitCell.value,
        enableSymmetryComputation: enableSymmetryComputation.value,
    });
});

</script>


<template>
<v-container class="container">
  <v-row class="mt-2">
    <v-label text="Symmetry group:" class="ml-3 mr-4" />
    <v-label :text="symmetryGroup" style="overflow-wrap: break-word;white-space: break-spaces;font-family: monospace;"
    class="w-50" />
  </v-row>
  <v-switch v-model="fillUnitCell" color="primary" label="Fill unit cell" class="ml-2 mt-6" />
  <v-switch v-model="enableSymmetryComputation" color="primary"
            label="Enable symmetry computation" class="ml-2 mt-n5" />
  <v-alert v-if="messageStore.applySymmetries.message !== ''" title="Error"
           :text="messageStore.applySymmetries.message" type="error" density="compact" color="red"
           style="cursor: pointer;" @click="messageStore.applySymmetries.message=''" />
</v-container>
</template>
