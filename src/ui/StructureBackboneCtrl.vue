<script setup lang="ts">
/**
 * @component
 * Controls for the backbone (e.g. protein chains) visualizer.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-02-28
 */
import {reactive, ref, watch} from "vue";
import {showAlertMessage} from "@/services/AlertMessage";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import type {CtrlParams} from "@/types";
import {StructureBackboneRenderer} from "@/renderers/StructureBackboneRenderer";

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

// Initialize the control
askNode(id, "init")
    .then((params) => {
        enableBackbone.value = params.enableStructureBackbone as boolean ?? false;
        chains.value.length = 0;
        for(const key in showChains) {
            if(Object.prototype.hasOwnProperty.call(showChains, key)) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete showChains[key];
            }
        }
        selectorKind.value = params.selectorKind as string ?? "label";
        atomsSelector.value = params.atomsSelector as string ?? "";
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`));

receiveFromNode(id, "chains", (params: CtrlParams) => {

    chains.value.length = 0;
    for(const chain of params.chains as string[] ?? []) {
        const chainToShow = (chain === "") ? "Remaining" : chain;
        showChains[chainToShow] = true;
        chains.value.push(chainToShow);
    }
});

watch([enableBackbone, showChains, selectorKind, atomsSelector], () => {

    const selectedChains: string[] = [];
    for(const key in showChains) {
        if(showChains[key]) selectedChains.push(key === "Remaining" ? "" : key);
    }
    sendToNode(id, "compute", {
        enableStructureBackbone: enableBackbone.value!,
        selectedChains,
        selectorKind: selectorKind.value,
        atomsSelector: atomsSelector.value,
        radius: radius.value,
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

// > Template
</script>


<template>
<v-container class="container">

  <v-switch v-model="enableBackbone"
            label="Show backbone" class="my-4 ml-2" />
  <g-atoms-selector v-model:kind="selectorKind" v-model:selector="atomsSelector"
                    :disabled="!enableBackbone" class="ml-1 mb-6"
                    title="Select backbone atoms by" placeholder="Atoms selectors" />
  <v-label v-if="chains.length > 0" class="ml-1 no-select">Select backbone segment:</v-label>
  <v-switch v-for="chain of chains" :key="chain" v-model="showChains[chain]"
            :disabled="!enableBackbone" :label="chain" class="ml-6" />
  <g-slider-with-steppers v-model="radius" class="mt-2"
                          v-model:raw="showRadius" label-width="6rem"
                          :label="`Radius (${showRadius.toFixed(1)})`"
                          :min="0" :max="2" :step="0.1" />
</v-container>
</template>
