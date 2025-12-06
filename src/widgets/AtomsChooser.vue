<script setup lang="ts">
/**
 * @component
 * Select atoms by various criteria.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {ref, watchEffect} from "vue";
import TitledSlot from "@/widgets/TitledSlot.vue";
import type {AtomSelectorModes} from "@/types";

// > Properties
const {disabled = false, hide = []} = defineProps<{

    /** Title for the widget */
    title: string;

    /** Placeholder text inside atoms selector */
    placeholder: string;

    /** Disable the component */
    disabled?: boolean;

    /** Hide some of the buttons */
    hide?: string[];
}>();

/** Returning kind of atom selection */
const labelKind = defineModel<AtomSelectorModes>("kind");

if(hide) {
    if(!hide.includes("symbol")) labelKind.value = "symbol";
    else if(!hide.includes("label")) labelKind.value = "label";
    else if(!hide.includes("index")) labelKind.value = "index";
    else if(!hide.includes("all")) labelKind.value = "all";
}
else labelKind.value = "symbol";

/** Returning selector string */
const atomsSelector = defineModel<string>("selector");

const atomsSelectorInternal = ref(atomsSelector.value);
watchEffect(() => {
    atomsSelectorInternal.value = atomsSelector.value;
});

const getSelector = (): void => {
    atomsSelector.value = atomsSelectorInternal.value ?? "";
};

/**
 * Check if a button should be hidden
 *
 * @param name - Name of the button to check
 * @returns True if the button is not hidden
 */
const notHidden = (name: string): boolean => {
    return !hide?.includes(name);
};

/**
 * Clear selector when selecting all atoms
 */
const clearSelector = (): void => {

    atomsSelectorInternal.value = "";
    atomsSelector.value = "";
};

</script>


<template>
<titled-slot :title class="ml-1">
  <v-btn-toggle v-model="labelKind" mandatory :disabled>
    <v-btn v-if="notHidden('symbol')" value="symbol">Symbol</v-btn>
    <v-btn v-if="notHidden('label')" value="label">Label</v-btn>
    <v-btn v-if="notHidden('index')" value="index">Index</v-btn>
    <v-btn v-if="notHidden('all')" value="all" @click="clearSelector">All</v-btn>
  </v-btn-toggle>
  <template #extra>
    <v-text-field v-model.trim="atomsSelectorInternal" :label="placeholder"
                  :disabled="labelKind === 'all' || disabled" class="mt-n2"
                  placeholder="Space separated list"
                  hide-details="auto" clearable spellcheck="false"
                  @blur="getSelector" @keyup.enter="getSelector"
                  @click:clear="getSelector" />
  </template>
</titled-slot>
</template>
