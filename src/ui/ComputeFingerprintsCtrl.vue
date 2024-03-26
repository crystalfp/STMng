<script setup lang="ts">
/**
 * @component
 * Controls for fingerprints computation.
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {useMessageStore} from "@/stores/messageStore";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

// Access the message store
const messageStore = useMessageStore();
messageStore.fingerprints.message = "";

const accumulate = ref(false);
const reset = ref(false);
const countAccumulated = ref(0);
const countSelected = ref(0);
const energyFileLoading = ref(false);
const energyFile = ref<File[]>([]);
const enableEnergyThreshold = ref(false);
const thresholdFromMinimum = ref(false);
const energyThreshold = ref(0);
const energyThresholdEffective = ref(0);

sb.getUiParams(props.id, (params: UiParams) => {
    accumulate.value = params.accumulate as boolean ?? false;
    reset.value = params.reset as boolean ?? false;
    countAccumulated.value = params.countAccumulated as number ?? 0;
    energyFileLoading.value = params.energyFileLoading as boolean ?? false;
    enableEnergyThreshold.value = params.enableEnergyThreshold as boolean ?? false;
    energyThreshold.value = params.energyThreshold as number ?? 0;
    energyThresholdEffective.value = params.energyThresholdEffective as number ?? 0;
    countSelected.value = params.countSelected as number ?? 0;
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        accumulate: accumulate.value,
        reset: reset.value,
        energyFilePath: energyFile.value[0]?.path ?? "",
        enableEnergyThreshold: enableEnergyThreshold.value,
        thresholdFromMinimum: thresholdFromMinimum.value,
        energyThreshold: energyThreshold.value,
    });
});


</script>


<template>
<v-container class="container">
  <v-label class="text-h6 w-100 justify-center mt-4">Accumulate structures</v-label>
    <v-row class="mx-0 my-4">
  <v-btn :color="accumulate ? 'red' : 'primary'" @click="accumulate = !accumulate">
      {{ accumulate ? "Stop accumulate" : "Start accumulate" }}
  </v-btn>
  <v-spacer />
  <v-btn @click="reset = true">Reset</v-btn>
  </v-row>
  <v-label class="mb-4 text-red-lighten-1 font-weight-bold">{{ `Structures loaded: ${countAccumulated}` }}</v-label>
  <v-divider thickness="8" />
  <v-label class="text-h6 w-100 justify-center mt-4">Filter structures</v-label>

  <v-file-input v-model="energyFile" label="Select energy file" :loading="energyFileLoading"
                :clearable="false" :persistent-clear="false" class="mt-2" />
  <v-switch v-model="enableEnergyThreshold" color="primary"
            label="Filter by energy" class="ml-2" />
  <v-switch v-model="thresholdFromMinimum" color="primary"
            label="Threshold from minimum energy" class="ml-2 mt-n5" />
  <v-row>
  <v-text-field v-model="energyThreshold" :label="thresholdFromMinimum ? 'Energy from minimum' : 'Max energy'"
                class="ml-2 mr-2" />
  <v-text-field v-model="energyThresholdEffective" label="Max energy" readonly class="ml-2 mr-2" />
  </v-row>

  <v-label class="mt-4 mb-4 text-red-lighten-1 font-weight-bold">
    {{ `Structures selected: ${countSelected} of ${countAccumulated}` }}</v-label>
  <v-divider thickness="8" />
  <v-label class="text-h6 w-100 justify-center mt-4">Compute fingerprints</v-label>

  <v-alert v-if="messageStore.fingerprints.message !== ''" title="Error" class="mt-7 cursor-pointer"
           :text="messageStore.fingerprints.message" type="error" density="compact"
           color="red" @click="messageStore.fingerprints.message=''" />

</v-container>
</template>
