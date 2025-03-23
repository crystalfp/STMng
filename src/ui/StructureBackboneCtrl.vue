<script setup lang="ts">
/**
 * @component
 * Controls for the backbone (e.g. protein chains) visualizer.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-02-28
 */
import {reactive, ref, watch} from "vue";
import {showSystemAlert} from "@/services/AlertMessage";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import type {CtrlParams} from "@/types";
import {StructureBackboneRenderer} from "@/renderers/StructureBackboneRenderer";

import AtomsChooser from "@/widgets/AtomsChooser.vue";
import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

/** Enable visualization of the backbone */
const enableBackbone = ref(false);

/** Chains present in the input structure and chains selected */
const chains = ref<string[]>([]);
const showChains = reactive<Record<string, boolean>>({});

/** Atoms selector for the nodes through which the backbone passes */
const selectorKind = ref("label");
const atomsSelector = ref("");

const renderer = new StructureBackboneRenderer(id);

/** Nodal points coordinates and various chains start and end indices */
let coordinates: number[];
let chainStart: number[];

const radius = ref(0.5);
const showRadius = ref(0.5);
const threshold = ref(0.9);
const showThreshold = ref(0.9);

// Initialize the control
askNode(id, "init")
    .then((params) => {
        enableBackbone.value = params.enableStructureBackbone as boolean ?? false;
        chains.value.length = 0;
        for(const key in showChains) {
            if(Object.hasOwn(showChains, key)) {
            // if(Object.prototype.hasOwnProperty.call(showChains, key)) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete showChains[key];
            }
        }
        selectorKind.value = params.selectorKind as string ?? "label";
        atomsSelector.value = params.atomsSelector as string ?? "";
        radius.value = params.radius as number ?? 0.5;
        showRadius.value = radius.value;
        threshold.value = params.threshold as number ?? 0.9;
        showThreshold.value = threshold.value;
    })
    .catch((error: Error) => showSystemAlert(`Error from UI init for ${label}: ${error.message}`));

receiveFromNode(id, "chains", (params: CtrlParams) => {

    const thoseChains = (params.chains as string[] ?? [])
                                    .map((chain) => (chain === "" ? "Remaining" : chain));

    // If the list of chains has not changed, don't reset the switch values
    let shouldReset = false;
    const tcSorted = thoseChains.toSorted((a, b) => a.localeCompare(b));
    const cSorted = chains.value.toSorted((a, b) => a.localeCompare(b));
    if(tcSorted.length === cSorted.length) {
        for(let i = 0; i < tcSorted.length; i++) {
            if(tcSorted[i] !== cSorted[i]) {
                shouldReset = true;
                break;
            }
        }
    }
    else shouldReset = true;

    chains.value.length = 0;
    for(const chain of thoseChains) {
        if(shouldReset) showChains[chain] = false;
        chains.value.push(chain);
    }
});

watch([enableBackbone, showChains, selectorKind, atomsSelector, threshold], () => {

    const selectedChains: string[] = [];
    for(const key in showChains) {
        if(showChains[key]) selectedChains.push(key.startsWith("Remaining") ? "" : key);
    }
    sendToNode(id, "compute", {
        enableStructureBackbone: enableBackbone.value,
        selectedChains,
        selectorKind: selectorKind.value,
        atomsSelector: atomsSelector.value,
        radius: radius.value,
        threshold: threshold.value
    });

}, {deep: true});

receiveFromNode(id, "positions", (params: CtrlParams) => {

    coordinates = params.coordinates as number[] ?? [];
    chainStart = params.chainStart as number[] ?? [];

    renderer.drawChains(coordinates, chainStart, radius.value, enableBackbone.value);
});

watch([radius, enableBackbone], () => {
    renderer.drawChains(coordinates, chainStart, radius.value, enableBackbone.value);
});

/**
 * Select or deselect all switches
 *
 * @param select - If true set all switches to on, otherwise to off
 */
const selectDeselect = (select: boolean): void => {
    for(const key in showChains) {
        showChains[key] = select;
    }
};

// > Template
</script>


<template>
<v-container class="container">

  <v-switch v-model="enableBackbone"
            label="Show backbone" class="mt-4 mb-2 ml-2" />
  <slider-with-steppers v-model="threshold" v-model:raw="showThreshold" label-width="8rem"
                          :label="`Threshold (${(showThreshold*100).toFixed(0)}%)`"
                          :min="0" :max="1" :step="0.1" />
  <slider-with-steppers v-model="radius" class="mb-6"
                          v-model:raw="showRadius" label-width="8rem"
                          :label="`Tube radius (${showRadius.toFixed(1)})`"
                          :min="0" :max="2" :step="0.1" />
  <atoms-chooser v-model:kind="selectorKind" v-model:selector="atomsSelector"
                    :disabled="!enableBackbone" class="ml-1 mb-6"
                    title="Select backbone atoms by" placeholder="Atoms selectors" />
  <v-label v-if="chains.length > 0" class="ml-1 no-select">Select backbone segment:</v-label>
  <v-switch v-for="chain of chains" :key="chain" v-model="showChains[chain]"
            :disabled="!enableBackbone" :label="chain" class="ml-6" />
  <v-row v-if="chains.length > 0" class="mt-2">
    <v-col cols="6">
      <v-btn block @click="selectDeselect(true)">Select All</v-btn>
    </v-col>
    <v-col cols="6">
      <v-btn block @click="selectDeselect(false)">Deselect All</v-btn>
    </v-col>
  </v-row>
</v-container>
</template>
