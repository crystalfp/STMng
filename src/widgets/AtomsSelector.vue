<script setup lang="ts">
/**
 * @component
 * Select atoms by various criteria.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {ref} from "vue";

// > Properties
const {disabled = false} = defineProps<{

    /** Title for the widget */
    title: string;

    /** Placeholder text inside atoms selector */
    placeholder: string;

    /** Disable the component */
    disabled?: boolean;
}>();

/** Returning kind of atom selection */
const labelKind = defineModel<string>("kind");

/** Returning selector string */
const atomsSelector = defineModel<string>("selector");

const atomsSelectorBase = ref(atomsSelector.value);
const getSelector = (): void => {
    atomsSelector.value = atomsSelectorBase.value ?? "";
};

</script>


<template>
<v-row class="pa-0 mt-2">
  <v-col cols="12" class="pa-0">
    <v-label :text="title" class="mb-1 no-select" />
  </v-col>
  <v-col cols="12" class="pa-0 mb-4">
    <v-btn-toggle v-model="labelKind" mandatory :disabled="disabled">
      <v-btn value="symbol">Symbol</v-btn>
      <v-btn value="label">Label</v-btn>
      <v-btn value="index">Index</v-btn>
      <v-btn value="all">All</v-btn>
    </v-btn-toggle>
  </v-col>
  <v-col cols="12" class="pa-0">
    <v-text-field v-model="atomsSelectorBase" :label="placeholder"
                  :disabled="labelKind === 'all' || disabled"
                  placeholder="Space separated list"
                  hide-details="auto" clearable spellcheck="false"
                  @blur="getSelector" @keyup.enter="getSelector"
                  @click:clear="getSelector"/>
  </v-col>
</v-row>
</template>
