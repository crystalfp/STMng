<script setup lang="ts">
/**
 * @component
 * Controls for the prototype matcher node.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-10-18
 */
import {reactive, ref, watch} from "vue";
import {resetNodeAlert, showNodeAlert} from "@/services/AlertMessage";
import {askNode, receiveFromNode} from "@/services/RoutesClient";
import type {CtrlParams} from "@/types";

import DebouncedSlider from "@/widgets/DebouncedSlider.vue";
import NodeAlert from "@/widgets/NodeAlert.vue";

const enableProto = ref(false);
const lengthTolerance = ref(0.2);
const siteTolerance = ref(0.3);
const angleTolerance = ref(5);
const formula = ref("");
const hasInput = ref(false);

type Prototype = [string, string];
const prototypes = reactive<Prototype[]>([]);

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

/**
 * Helper function to decode the list of prototypes
 *
 * @param list - JSON encoded list of prototypes
 */
const fillPrototypes = (list: string | undefined): void => {

    prototypes.length = 0;
    if(!list) {
        prototypes.push(["No match found", ""]);
        return;
    }
    const prototypesAll = JSON.parse(list) as Prototype[];
    for(const entry of prototypesAll) prototypes.push(entry);
};

// > Initialize ui
resetNodeAlert();

askNode(id, "init")
    .then((params) => {
		enableProto.value = params.enabled as boolean ?? false;
		lengthTolerance.value = params.lengthTolerance as number ?? 0.2;
		siteTolerance.value = params.siteTolerance as number ?? 0.3;
		angleTolerance.value = params.angleTolerance as number ?? 5;
		fillPrototypes(params.match as string);
        formula.value = params.formula as string ?? "";
        hasInput.value = params.hasInput as boolean ?? false;
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from UI init for "${label}": ${error.message}`,
                      "prototypeMatcher");
    });

/** Changed module enable status */
watch([enableProto], () => {

    askNode(id, "enable", {enabled: enableProto.value})
        .then((params) => {
            if(params.error) throw Error(params.error as string);
		    fillPrototypes(params.match as string);
            formula.value = params.formula as string ?? "";
            hasInput.value = params.hasInput as boolean ?? false;
        })
        .catch((error: Error) => {
            const message = `Error from "${label}": ${error.message}`;
            showNodeAlert(message, "prototypeMatcher", {alsoSystem: true});
            prototypes.length = 0;
        });
});

/** Changed computing tolerances */
watch([lengthTolerance, siteTolerance, angleTolerance], () => {

    if(!enableProto.value) return;
    askNode(id, "tolerances", {
            lengthTolerance: lengthTolerance.value,
            siteTolerance: siteTolerance.value,
            angleTolerance: angleTolerance.value
        })
        .then((params) => {
            if(params.error) throw Error(params.error as string);
		    fillPrototypes(params.match as string);
            formula.value = params.formula as string ?? "";
            hasInput.value = params.hasInput as boolean ?? false;
        })
        .catch((error: Error) => {
            const message = `Error from "${label}": ${error.message}`;
            showNodeAlert(message, "prototypeMatcher", {alsoSystem: true});
            prototypes.length = 0;
        });
});

/** Receive result of the matching */
receiveFromNode(id, "match", (params: CtrlParams) => {
    if(params.error) {
        const message = `Error from "${label}": ${params.error as string}`;
        showNodeAlert(message, "prototypeMatcher", {alsoSystem: true});
        prototypes.length = 0;
        formula.value = "";
    }
    else {
		fillPrototypes(params.match as string);
        formula.value = params.formula as string ?? "";
    }
    hasInput.value = params.hasInput as boolean ?? false;
});

/**
 * Reset parameters to default values
 */
const resetParams = (): void => {

    lengthTolerance.value = 0.2;
    siteTolerance.value = 0.3;
    angleTolerance.value = 5;
    prototypes.length = 0;
};

</script>


<template>
<v-container class="container">
  <v-switch v-model="enableProto" label="Enable prototype matcher" class="mt-6 ml-3" />
  <debounced-slider v-slot="{value}" v-model="lengthTolerance" :disabled="!enableProto"
                      :min="0.05" :max="0.4" :step="0.05" class="ml-2 mb-3 mt-6">
    <v-label :text="`Fractional length tolerance (${value.toFixed(2)})`" class="no-select" />
  </debounced-slider>
  <debounced-slider v-slot="{value}" v-model="siteTolerance" :disabled="!enableProto"
                      :min="0.05" :max="0.6" :step="0.05" class="ml-2 mb-3 mt-2">
    <v-label :text="`Site tolerance (${value.toFixed(2)})`" class="no-select" />
  </debounced-slider>
  <debounced-slider v-slot="{value}" v-model="angleTolerance" :disabled="!enableProto"
                      :min="0.5" :max="10" :step="0.5" class="ml-2 mb-3 mt-2">
    <v-label :text="`Angle tolerance (${value.toFixed(1)})`" class="no-select" />
  </debounced-slider>
  <v-btn block class="mt-5 mb-4" :disabled="!enableProto"
         @click="resetParams">Reset parameters</v-btn>
  <v-container v-if="enableProto && hasInput" class="mt-2 ml-2 mb-6 pa-0">
  <v-label v-if="formula !== ''" class="mb-3 pb-1 bigger" v-html="`Prototypes for ${formula}`" />
    <v-container v-for="entry of prototypes" :key="entry[1]" class="mb-4 pa-0">
      <v-label class="result-label pb-1 bigger" v-html="entry[0]" /><br>
      <v-label class="bigger">{{ `(Aflow: ${entry[1]})` }}</v-label>
    </v-container>
  </v-container>
  <node-alert node="prototypeMatcher" />
</v-container>
</template>


<style scoped>
.bigger {
  overflow-wrap: break-word;
  white-space: break-spaces;
  font-size: 1.1rem;
  line-height: 1.4;
}

:deep(sub) {
  position: relative;
  bottom: -0.5rem;
}
</style>
