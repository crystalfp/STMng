<script setup lang="ts">
/**
 * @component
 * Select the volumetric dataset.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-12-05
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
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
  <v-label v-if="countDatasets === 0" class="mb-4 result-label">There is no volumetric data</v-label>
  <div v-else>
    <v-label :text="`Dataset (${dataset})`" class="ml-1 no-select" />
    <v-slider v-model="dataset" min="0" :max="countDatasets-1" step="1" class="ml-2 mr-6" />
  </div>
</v-container>
</template>
