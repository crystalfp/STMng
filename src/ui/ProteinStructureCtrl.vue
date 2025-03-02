<script setup lang="ts">
/**
 * @component
 * Controls for the protein structure visualizer.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-02-28
 */
import {reactive, ref} from "vue";
import {showAlertMessage} from "@/services/AlertMessage";
import {askNode, receiveFromNode} from "@/services/RoutesClient";
import type {CtrlParams} from "@/types";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

const enableProteinStructure = ref<boolean | null>(false);
const chains = ref<string[]>([]);
const showChains = reactive<Record<string, boolean | null>>({});


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
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`));

receiveFromNode(id, "chains", (params: CtrlParams) => {
    chains.value.length = 0;
    for(const chain of params.chains as string[] ?? []) {
        chains.value.push(chain);
        showChains[chain] = false;
    }
});
</script>


<template>
<v-container class="container">

<v-switch v-model="enableProteinStructure"
          label="Show protein structure" class="my-4 ml-2" />
<v-label v-if="chains.length > 0">Show:</v-label>
<v-switch v-for="chain of chains" :key="chain" model-value="showChains[chain]"
          :label='`Chain "${chain}"`'
          class="ml-6" :disabled="!enableProteinStructure" />
</v-container>
</template>
