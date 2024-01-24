<script setup lang="ts">

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";

// > Properties
const pr = defineProps<{

    /** Its own module id */
    id: string;
}>();

// > Get and set ui parameters from the switchboard
const symmetryGroup = ref("");
const fillUnitCell = ref(false);
const enableSymmetryComputation = ref(true);
const errorMessage = ref("");

sb.getUiParams(pr.id, (params: UiParams) => {

    symmetryGroup.value = params.symmetryGroup as string ?? "";
    fillUnitCell.value  = params.fillUnitCell as boolean ?? false;
    enableSymmetryComputation.value = params.enableSymmetryComputation as boolean ?? true;
    errorMessage.value = params.error as string ?? "";
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
    <v-label :text="symmetryGroup" style="white-space: break-spaces;font-family:monospace;" />
  </v-row>
  <v-alert v-if="errorMessage !== ''" title="Error" :text="errorMessage" type="error" density="compact" color="red" />
  <v-switch v-model="fillUnitCell" color="primary" label="Fill unit cell" class="ml-2 mt-6" />
  <v-switch v-model="enableSymmetryComputation" color="primary"
            label="Enable symmetry computation" class="ml-2 mt-n5" />
</v-container>
</template>
