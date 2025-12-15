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

const errorStatus = ref(false);
const errorMessage = ref("");
const atomSymbols = new Set(["d", "h", "he", "li", "be", "b", "c", "n", "o", "f", "ne", "na", "mg", "al", "si", "p", "s", "cl", "ar", "k", "ca", "sc", "ti", "v", "cr", "mn", "fe", "co", "ni", "cu", "zn", "ga", "ge", "as", "se", "br", "kr", "rb", "sr", "y", "zr", "nb", "mo", "tc", "ru", "rh", "pd", "ag", "cd", "in", "sn", "sb", "te", "i", "xe", "cs", "ba", "la", "ce", "pr", "nd", "pm", "sm", "eu", "gd", "tb", "dy", "ho", "er", "tm", "yb", "lu", "hf", "ta", "w", "re", "os", "ir", "pt", "au", "hg", "tl", "pb", "bi", "po", "at", "rn", "fr", "ra", "ac", "th", "pa", "u", "np", "pu", "am", "cm", "bk", "cf", "es", "fm", "md", "no", "lr", "rf", "db", "sg", "bh", "hs", "mt", "ds", "rg"]);

/**
 * Validate atomic symbols
 *
 * @param selector - The selector string from the text area
 * @returns True if each entry is a valid symbol
 */
const validSymbols = (selector: string): boolean => {

    const entries = selector.split(/ +/);
    for(const entry of entries) if(!atomSymbols.has(entry.toLowerCase())) return false;
    return true;
};

/**
 * Validate indices
 *
 * @param selector - The selector string from the text area
 * @returns True if each entry is a valid number
 */
const validIndex =  (selector: string): boolean => {

    const entries = selector.split(/ +/);
    for(const entry of entries) if(!/^\d+$/.test(entry)) return false;
    return true;
};

/**
 * Get the selector entered, validate it and return to the parent
 */
const getSelector = (): void => {

    errorStatus.value = false;
    errorMessage.value = "";

    if(labelKind.value === "all") {
        atomsSelector.value = "";
        return;
    }
    const selector = atomsSelectorInternal.value;

    if(!selector) {
        atomsSelector.value = "";
        return;
    }
    if(labelKind.value === "symbol" && !validSymbols(selector)) {
        errorStatus.value = true;
        errorMessage.value = "Invalid atom symbol";
        return;
    }
    if(labelKind.value === "index" && !validIndex(selector)) {
        errorStatus.value = true;
        errorMessage.value = "Non numeric index";
        return;
    }

    atomsSelector.value = selector;
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
 * Clear selector when selecting all atoms or clearing the field
 */
const clearSelector = (): void => {

    atomsSelectorInternal.value = "";
    atomsSelector.value = "";
    errorStatus.value = false;
    errorMessage.value = "";
};
// hide-details="auto"
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
                  :error="errorStatus" :error-messages="errorMessage"
                  clearable spellcheck="false"
                  @blur="getSelector" @keyup.enter="getSelector"
                  @click:clear="clearSelector" />
  </template>
</titled-slot>
</template>
