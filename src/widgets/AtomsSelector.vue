<script setup lang="ts">
/**
 * @component
 * Select atoms by various criteria.
 */

// > Properties
defineProps<{

    /** Title for the widget */
    title: string;

    /** Placeholder text inside atoms selector */
    placeholder: string;
}>();

/** Returning kind of atom selection */
const labelKind = defineModel<string>("kind");

/** Returning selector string */
const atomsSelector = defineModel<string>("selector");

</script>


<template>
<v-container class="pa-0">
  <v-label :text="title" class="mb-3" /><br>
  <v-btn-toggle v-model="labelKind" color="primary" class="mb-6">
    <v-btn value="symbol">Symbol</v-btn>
    <v-btn value="label">Label</v-btn>
    <v-btn value="index">Index</v-btn>
    <v-btn value="all">All</v-btn>
  </v-btn-toggle>
  <v-text-field v-model="atomsSelector" :label="placeholder" :disabled="labelKind === 'all'"
                placeholder="Space separated list"
                variant="solo-filled" hide-details="auto" clearable />
</v-container>
</template>
