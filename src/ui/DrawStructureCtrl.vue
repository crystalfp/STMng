<script setup lang="ts">
/**
 * @component
 * Controls for the converter from structure data to graphical objects.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-27
 */
import {ref, watch, computed} from "vue";
import {askNode, receiveFromNodeForRendering, sendToNode} from "@/services/RoutesClient";
import {showAlertMessage, resetAlertMessage} from "@/services/AlertMessage";
import {DrawStructureRenderer} from "@/renderers/DrawStructureRenderer";
import type {StructureRenderInfo} from "@/types";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// > Get and set ui parameters from the switchboard
const drawKind = ref("ball-and-stick");
const drawQuality = ref(4);
const drawRoughness = ref(0.5);
const drawMetalness = ref(0.6);
const labelKind = ref("symbol");
const showStructure = ref(true);
const showBonds = ref(true);
const showLabels = ref(true);
const shadedBonds = ref(false);
let renderInfo: StructureRenderInfo;

resetAlertMessage("system");
askNode(id, "init")
    .then((params) => {

        drawKind.value = params.drawKind as string ?? "ball-and-stick";
        drawQuality.value = params.drawQuality as number ?? 4;
        drawRoughness.value = params.drawRoughness as number ?? 0.5;
        drawMetalness.value = params.drawMetalness as number ?? 0.6;
        labelKind.value = params.labelKind as string ?? "symbol";
        showBonds.value = params.showBonds as boolean ?? true;
        showStructure.value = params.showStructure as boolean ?? true;
        showLabels.value = params.showLabels as boolean ?? true;
        shadedBonds.value = params.shadedBonds as boolean ?? false;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`));

// > Initialize graphical rendering
const renderer = new DrawStructureRenderer(id, drawQuality.value,
				                           drawRoughness.value, drawMetalness.value);

// Receive new structure from main process
receiveFromNodeForRendering(id, "structure", (updatedRenderInfo: StructureRenderInfo) => {

    renderInfo = updatedRenderInfo;
    renderer.adjustMaterials(drawQuality.value, drawRoughness.value, drawMetalness.value);
    renderer.drawStructure(renderInfo, drawKind.value, shadedBonds.value!);
    renderer.drawLabels(renderInfo, showLabels.value, drawKind.value, labelKind.value);
});

// Change draw parameters
watch([labelKind, drawKind, shadedBonds], () => {

    if(renderInfo) {
        renderer.drawStructure(renderInfo, drawKind.value, shadedBonds.value!);
        renderer.drawLabels(renderInfo, showLabels.value, drawKind.value, labelKind.value);
    }
    sendToNode(id, "save", {
        labelKind: labelKind.value,
        drawKind: drawKind.value,
        shadedBonds: shadedBonds.value!
    });
});

// Change visibility
watch([showStructure, showBonds, showLabels], () => {

    renderer.setVisibility(showStructure.value, showBonds.value, showLabels.value);

    sendToNode(id, "save", {
        showStructure: showStructure.value,
        showBonds: showBonds.value,
        showLabels: showLabels.value
    });
});

// Change material parameters
watch([drawRoughness, drawMetalness, drawQuality], () => {

    renderer.adjustMaterials(drawQuality.value, drawRoughness.value, drawMetalness.value);
    sendToNode(id, "save", {
        drawRoughness: drawRoughness.value,
        drawMetalness: drawMetalness.value,
        drawQuality: drawQuality.value
    });
});

// Convert the button toggle into three booleans
const showCombined = computed({
    get: () => {
        const result = [];
        if(showStructure.value) result.push("structure");
        if(showBonds.value) result.push("bonds");
        if(showLabels.value) result.push("labels");
        return result;
    },
    set: (values) => {
        showStructure.value = values.includes("structure");
        showBonds.value = values.includes("bonds");
        showLabels.value = values.includes("labels");
    }
});

</script>


<template>
<v-container class="container">
  <v-row>
    <v-col cols="12" class="pa-0 ml-5 mt-6 mb-n2">
      <v-label text="Structure rendering mode" class="no-select" />
    </v-col>
    <v-col>
      <v-btn-toggle v-model="drawKind" mandatory class="mb-6 ml-2">
        <v-btn value="ball-and-stick">CPK</v-btn>
        <v-btn value="van-der-waals">VdW</v-btn>
        <v-btn value="licorice">Licorice</v-btn>
        <v-btn value="lines">Lines</v-btn>
      </v-btn-toggle>
    </v-col>
  </v-row>

  <v-switch v-model="shadedBonds" label="Smooth color bonds" class="mt-n2 mb-4 ml-4" />

  <v-row>
    <v-col cols="12" class="pa-0 ml-5 mt-2 mb-n2">
      <v-label text="Atom label" class="no-select" />
    </v-col>
    <v-col>
      <v-btn-toggle v-model="labelKind" mandatory class="mb-2 ml-2">
        <v-btn value="symbol">Symbol</v-btn>
        <v-btn value="label">Label</v-btn>
        <v-btn value="index">Index</v-btn>
      </v-btn-toggle>
    </v-col>
  </v-row>

  <v-row>
    <v-col cols="12" class="pa-0 ml-5 mb-n2">
      <v-label text="Visibility" class="no-select" />
    </v-col>
    <v-col>
      <v-btn-toggle v-model="showCombined" multiple class="ml-2 mb-2">
        <v-btn value="structure">Structure</v-btn>
        <v-btn value="bonds">Bonds</v-btn>
        <v-btn value="labels">Labels</v-btn>
      </v-btn-toggle>
    </v-col>
  </v-row>

  <v-row>
    <v-col cols="12" class="pa-0 ml-5 mb-n2">
      <v-label text="Quality" class="no-select" />
    </v-col>
    <v-col>
      <v-btn-toggle v-model="drawQuality" mandatory class="ml-2">
        <v-btn :value="1">Low</v-btn>
        <v-btn :value="2">Medium</v-btn>
        <v-btn :value="3">Good</v-btn>
        <v-btn :value="4">Best</v-btn>
      </v-btn-toggle>
    </v-col>
  </v-row>

  <g-debounced-slider v-slot="{value}" v-model="drawRoughness"
                      :min="0" :max="1" :step="0.1" class="ml-2 mt-6">
    <v-label :text="`Roughness (${value.toFixed(2)})`" class="no-select" />
  </g-debounced-slider>
  <g-debounced-slider v-slot="{value}" v-model="drawMetalness"
                      :min="0" :max="1" :step="0.1" class="ml-2 mt-4">
    <v-label :text="`Metalness (${value.toFixed(2)})`" class="no-select" />
  </g-debounced-slider>
</v-container>
</template>
