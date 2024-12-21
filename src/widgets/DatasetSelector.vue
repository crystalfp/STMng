<script setup lang="ts">
/**
 * @component
 * Select the volumetric dataset.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-05
 */

// > Properties
const {countDatasets} = defineProps<{

    /** Number of volumetric datasets (zero if none) */
    countDatasets: number;
}>();

const dataset = defineModel<number>();
</script>


<template>
<v-container class="pa-0">
  <v-label v-if="countDatasets === 0" class="ml-2 mb-4 green-label">There is no volumetric data</v-label>
  <div v-else>
    <v-label :text="`Dataset (${dataset})`" class="ml-2 no-select" />
    <v-slider v-model="dataset" min="0" :max="countDatasets-1" step="1" class="ml-5 mr-5" />
  </div>
</v-container>
</template>
