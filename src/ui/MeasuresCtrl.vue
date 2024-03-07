<script setup lang="ts">
/**
 * @component
 * Controls for the symmetry (find and apply) node.
 */

import {ref} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {useConfigStore} from "@/stores/configStore";

// > Properties
const properties = defineProps<{

    /** Its own module id */
    id: string;
}>();

// > Access the stores
const configStore = useConfigStore();

interface SelectedAtoms {
    index: number;
    label: string;
    symbol: string;
    color: string;
}

const distanceAB = ref("");
const distanceBC = ref("");
const distanceAC = ref("");
const angleABC   = ref("");
const details    = ref<SelectedAtoms[]>([]);

sb.getUiParams(properties.id, (params: UiParams) => {

    distanceAB.value = params.distanceAB as string ?? "";
    distanceBC.value = params.distanceBC as string ?? "";
    distanceAC.value = params.distanceAC as string ?? "";
    angleABC.value   = params.angleABC as string ?? "";
    details.value    = JSON.parse(params.details as string ?? "[]") as SelectedAtoms[];
});

</script>


<template>
<v-container class="container">
  <v-label class="text-h5 w-100 justify-center mb-2 mt-2">Selected atoms</v-label>
  <v-table density="default">
    <tr v-for="line of details" :key="line.index">
      <td :style="`color: ${line.color}`">{{ `Atom ${line.label}:` }}</td>
      <td>{{ line.symbol }}</td>
    </tr>
  </v-table>
  <v-btn class="mt-4 mb-4" block @click="configStore.deselectAtoms()">Deselect</v-btn>
  <v-label class="text-h5 w-100 justify-center mb-2">Measures</v-label>
  <v-table density="default">
    <tr v-if="distanceAB !== ''"><td>Distance A–B:</td><td>{{ distanceAB }}</td></tr>
    <tr v-if="distanceBC !== ''"><td>Distance B–C:</td><td>{{ distanceBC }}</td></tr>
    <tr v-if="distanceAC !== ''"><td>Distance A–C:</td><td>{{ distanceAC }}</td></tr>
    <tr v-if="angleABC !== ''"><td>Angle A–B–C:</td><td>{{ angleABC }}</td></tr>
  </v-table>
</v-container>
</template>
