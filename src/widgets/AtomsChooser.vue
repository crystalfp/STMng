<script setup lang="ts">
/**
 * @component
 * Select atoms by various criteria.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {ref, watchEffect} from "vue";

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
const labelKind = defineModel<string>("kind");

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

</script>


<template>
<v-row class="pa-0 mt-2">
  <v-col cols="12" class="pa-0">
    <v-label :text="title" class="mb-1 ml-1 no-select" />
  </v-col>
  <v-col cols="12" class="pa-0 mb-4">
    <v-btn-toggle v-model="labelKind" mandatory :disabled>
      <v-btn v-if="notHidden('symbol')" value="symbol">Symbol</v-btn>
      <v-btn v-if="notHidden('label')" value="label">Label</v-btn>
      <v-btn v-if="notHidden('index')" value="index">Index</v-btn>
      <v-btn v-if="notHidden('all')" value="all">All</v-btn>
    </v-btn-toggle>
  </v-col>
  <v-col cols="12" class="pa-0">
    <v-text-field v-model="atomsSelectorInternal" :label="placeholder"
                  :disabled="labelKind === 'all' || disabled"
                  placeholder="Space separated list"
                  hide-details="auto" clearable spellcheck="false"
                  @blur="getSelector" @keyup.enter="getSelector"
                  @click:clear="getSelector"/>
  </v-col>
</v-row>
</template>
