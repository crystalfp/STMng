<script setup lang="ts">
/**
 * @component
 * Controls for the volume data interpolator.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
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
import {onUnmounted, ref, watch} from "vue";
import {askNode, sendToNode, receiveFromNode} from "@/services/RoutesClient";
import {showSystemAlert} from "@/services/AlertMessage";
import type {CtrlParams} from "@/types";

import DatasetSelector from "@/widgets/DatasetSelector.vue";
import DebouncedSlider from "@/widgets/DebouncedSlider.vue";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

const interpolateVolume = ref(false);
const pointsToAdd = ref(1);
const dataset = ref(0);
const countDatasets = ref(0);

askNode(id, "init")
    .then((params) => {

		interpolateVolume.value = params.interpolateVolume as boolean ?? false;
		pointsToAdd.value = params.pointsToAdd as number ?? 1;
    })
    .catch((error: Error) => {
        showSystemAlert(`Error from UI init for ${label}: ${error.message}`);
    });

receiveFromNode(id, "countDatasets", (params: CtrlParams) => {
    countDatasets.value = params.countDatasets as number ?? 0;
});

const stopWatcher = watch([interpolateVolume, pointsToAdd, dataset], () => {
    sendToNode(id, "change", {
        interpolateVolume: interpolateVolume.value,
        pointsToAdd: pointsToAdd.value,
        dataset: dataset.value,
    });
});

// Cleanup
onUnmounted(() => stopWatcher());

</script>


<template>
<v-container class="container">
  <v-switch v-model="interpolateVolume"
            label="Interpolate volume data" class="mt-4 ml-1 mb-4" />

  <dataset-selector v-model="dataset" :count-datasets />

  <debounced-slider v-slot="{value}" v-model="pointsToAdd" :step="1" :min="1" :max="10"
                      :disabled="!interpolateVolume" class="mt-1">
    <v-label :text="`Points to add (${value})`" class="no-select" />
  </debounced-slider>
</v-container>
</template>
