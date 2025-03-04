<script setup lang="ts">
/**
 * @component
 * Controls for the protein structure visualizer.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-02-28
 */
import {reactive, ref, watch} from "vue";
import {showAlertMessage} from "@/services/AlertMessage";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import type {CtrlParams} from "@/types";
import {ProteinStructureRenderer} from "@/renderers/ProteinStructureRenderer";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

/** Enable visualization of the backbone */
const enableProteinStructure = ref(false);

/** Chains present in the input structure and chains selected */
const chains = ref<string[]>([]);
const showChains = reactive<Record<string, boolean>>({});

/** Atoms selector for the nodes through which the backbone passes */
const selectorKind = ref("label");
const atomsSelector = ref("");

const renderer = new ProteinStructureRenderer(id);

let coordinates: number[];
let chainStart: number[];

const radius = ref(0.5);
const showRadius = ref(0.5);

// Initialize the control
askNode(id, "init")
    .then((params) => {
        enableProteinStructure.value = params.enableProteinStructure as boolean ?? false;
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
        chains.value.push(chain);
        showChains[chain] = false;
    }
});

watch([enableProteinStructure, showChains, selectorKind, atomsSelector], () => {

    const selectedChains: string[] = [];
    for(const key in showChains) if(showChains[key]) selectedChains.push(key);

    sendToNode(id, "compute", {
        enableProteinStructure: enableProteinStructure.value!,
        selectedChains,
        selectorKind: selectorKind.value,
        atomsSelector: atomsSelector.value,
        radius: radius.value,
    });

}, {deep: true});

receiveFromNode(id, "positions", (params: CtrlParams) => {

    coordinates = params.coordinates as number[] ?? [];
    chainStart = params.chainStart as number[] ?? [];

    renderer.drawChains(coordinates, chainStart, radius.value, enableProteinStructure.value);
});

watch([radius, enableProteinStructure], () => {
    renderer.drawChains(coordinates, chainStart, radius.value, enableProteinStructure.value);
});

// > Template
</script>


<template>
<v-container class="container">

  <v-switch v-model="enableProteinStructure"
            label="Show protein structure" class="my-4 ml-2" />
  <g-atoms-selector v-model:kind="selectorKind" v-model:selector="atomsSelector"
                    :disabled="!enableProteinStructure" class="ml-1 mb-6"
                    title="Select chain atoms by" placeholder="Chain atoms selector" />
  <v-label v-if="chains.length > 0" class="ml-1 no-select">Show chain:</v-label>
  <v-switch v-for="chain of chains" :key="chain" v-model="showChains[chain]"
            :disabled="!enableProteinStructure" :label="chain" class="ml-6" />
  <g-slider-with-steppers v-model="radius" class="mt-2"
                          v-model:raw="showRadius" label-width="6rem"
                          :label="`Radius (${showRadius.toFixed(1)})`"
                          :min="0" :max="2" :step="0.1" />
</v-container>
</template>
