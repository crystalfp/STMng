<script setup lang="ts">
/**
 * @component
 * Controls for the render of the structure data to graphical objects.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-27
 */
import {ref, watch, computed} from "vue";
import {askNode, receiveFromNodeForRendering, sendToNode} from "@/services/RoutesClient";
import {showSystemAlert, resetNodeAlert} from "@/services/AlertMessage";
import {DrawStructureRenderer} from "@/renderers/DrawStructureRenderer";
import {useControlStore} from "@/stores/controlStore";
import type {StructureRenderInfo, ColoringType} from "@/types";

import DebouncedSlider from "@/widgets/DebouncedSlider.vue";
import ColorSelector from "@/widgets/ColorSelector.vue";
import TitledSlot from "@/widgets/TitledSlot.vue";

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
const showAtoms = ref(true);
const showBonds = ref(true);
const showLabels = ref(true);
const shadedBonds = ref(false);
let renderInfo: StructureRenderInfo;
const showBondsStrengths = ref(false);
const atomColoring = ref<ColoringType>("type");
const monochromeColor = ref("#888888");
const bondsRadiusMultiplier = ref(1);

// > Access the stores
const controlStore = useControlStore();

resetNodeAlert();
askNode(id, "init")
    .then((params) => {

        drawKind.value = params.drawKind as string ?? "ball-and-stick";
        drawQuality.value = params.drawQuality as number ?? 4;
        drawRoughness.value = params.drawRoughness as number ?? 0.5;
        drawMetalness.value = params.drawMetalness as number ?? 0.6;
        labelKind.value = params.labelKind as string ?? "symbol";
        showBonds.value = params.showBonds as boolean ?? true;
        showAtoms.value = params.showAtoms as boolean ?? true;
        showLabels.value = params.showLabels as boolean ?? true;
        shadedBonds.value = params.shadedBonds as boolean ?? false;
        showBondsStrengths.value = params.showBondsStrengths as boolean ?? false;
        atomColoring.value = params.atomColoring as ColoringType ?? "type";
        monochromeColor.value = params.monochromeColor as string ?? "#888888";
    })
    .catch((error: Error) => showSystemAlert(`Error from UI init for ${label}: ${error.message}`));

// > Initialize graphical rendering
const renderer = new DrawStructureRenderer(id, drawQuality.value,
				                           drawRoughness.value, drawMetalness.value);

// Receive new structure from main process
receiveFromNodeForRendering(id, "structure", (updatedRenderInfo: StructureRenderInfo) => {

    renderInfo = updatedRenderInfo;
    renderer.adjustMaterials(drawQuality.value, drawRoughness.value, drawMetalness.value);
    renderer.drawStructure(renderInfo, drawKind.value, shadedBonds.value,
                           showBondsStrengths.value, atomColoring.value,
                           monochromeColor.value, bondsRadiusMultiplier.value);
    renderer.drawLabels(renderInfo, showLabels.value, drawKind.value, labelKind.value);

    // Save basis to orient camera along cell sides
    for(let i=0; i < 9; ++i) controlStore.basis[i] = renderInfo.cell.basis[i];
});

// Change draw parameters
watch([labelKind, drawKind, shadedBonds, showBondsStrengths,
       bondsRadiusMultiplier, atomColoring, monochromeColor], () => {

    if(renderInfo) {
        renderer.drawStructure(renderInfo, drawKind.value, shadedBonds.value,
                               showBondsStrengths.value, atomColoring.value,
                               monochromeColor.value, bondsRadiusMultiplier.value);
        renderer.drawLabels(renderInfo, showLabels.value, drawKind.value, labelKind.value);
    }
    sendToNode(id, "save", {
        labelKind: labelKind.value,
        drawKind: drawKind.value,
        shadedBonds: shadedBonds.value,
        showBondsStrengths: showBondsStrengths.value,
        atomColoring: atomColoring.value,
        monochromeColor: monochromeColor.value,
        bondsRadiusMultiplier: bondsRadiusMultiplier.value
    });
});

// Change visibility
watch([showAtoms, showBonds, showLabels], () => {

    renderer.setVisibility(showAtoms.value, showBonds.value, showLabels.value);

    sendToNode(id, "save", {
        showAtoms: showAtoms.value,
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

const showAll = ref(false);

// Convert the button toggle into three booleans
// The forth one is setting/deselecting all of them
const showCombined = computed({
    get: () => {
        const result = [];
        if(showAtoms.value) result.push("atoms");
        if(showBonds.value) result.push("bonds");
        if(showLabels.value) result.push("labels");
        return result;
    },
    set: (values) => {
        showAtoms.value = values.includes("atoms");
        showBonds.value = values.includes("bonds");
        showLabels.value = values.includes("labels");
        if(values.includes("display")) {
            showAtoms.value = showAll.value;
            showBonds.value = showAll.value;
            showLabels.value = showAll.value;
            showAll.value = !showAll.value;
        }
    }
});

// Disable controls depending on the status
const disableShadedBonds = computed(() =>
    (drawKind.value !== "ball-and-stick" && drawKind.value !== "licorice") ||
    !showBonds.value
);

const disableBondsStrengths = computed(() =>
    drawKind.value !== "ball-and-stick" || !showBonds.value
);

</script>


<template>
<v-container class="container">
  <titled-slot title="Structure rendering mode" class="my-6 ml-2">
    <v-btn-toggle v-model="drawKind" mandatory>
      <v-btn value="ball-and-stick">CPK</v-btn>
      <v-btn value="van-der-waals">VdW</v-btn>
      <v-btn value="licorice">Licorice</v-btn>
      <v-btn value="lines">Lines</v-btn>
    </v-btn-toggle>
  </titled-slot>

  <v-switch v-model="shadedBonds" :disabled="disableShadedBonds"
            label="Smooth color bonds" class="mt-n4 ml-4" />
  <v-switch v-model="showBondsStrengths" :disabled="disableBondsStrengths"
            label="Show bonds strengths" class="mt-n1 mb-5 ml-4" />
  <debounced-slider v-slot="{value}" v-model="bondsRadiusMultiplier" :disabled="disableShadedBonds"
                      :min="0.1" :max="3" :step="0.1" class="ml-2 mt-n2 mb-6">
    <v-label :text="`Bonds radius multiplier (${value.toFixed(1)})`" class="no-select" />
  </debounced-slider>

  <titled-slot title="Atom label" class="mb-2 ml-2">
    <v-btn-toggle v-model="labelKind" :disabled="!showLabels" mandatory>
      <v-btn value="symbol">Symbol</v-btn>
      <v-btn value="label">Label</v-btn>
      <v-btn value="index">Index</v-btn>
    </v-btn-toggle>
  </titled-slot>

  <titled-slot title="Atom color" class="mb-2 ml-2">
    <v-btn-toggle v-model="atomColoring" :disabled="!showAtoms || drawKind === 'lines'" mandatory>
      <v-btn value="type">Type</v-btn>
      <v-btn value="mono">Mono</v-btn>
      <v-btn value="bonds">Bonds</v-btn>
    </v-btn-toggle>
    <template #extra>
      <color-selector v-if="atomColoring==='mono'" v-model="monochromeColor"
                      label="Atom mono color" block class="mb-2" />
    </template>
  </titled-slot>

  <titled-slot title="Visibility" class="mb-2 ml-2 mt-n4">
    <v-btn-toggle v-model="showCombined" multiple>
      <v-btn value="atoms">Atoms</v-btn>
      <v-btn value="bonds">Bonds</v-btn>
      <v-btn value="labels">Labels</v-btn>
      <v-btn value="display">{{ showAll ? "Show" : "Hide" }}</v-btn>
    </v-btn-toggle>
  </titled-slot>

  <titled-slot title="Quality" class="ml-2">
    <v-btn-toggle v-model="drawQuality" mandatory>
      <v-btn :value="1">Low</v-btn>
      <v-btn :value="2">Medium</v-btn>
      <v-btn :value="3">Good</v-btn>
      <v-btn :value="4">Best</v-btn>
    </v-btn-toggle>
  </titled-slot>

  <debounced-slider v-slot="{value}" v-model="drawRoughness"
                      :min="0" :max="1" :step="0.1" class="ml-2 mt-6">
    <v-label :text="`Roughness (${value.toFixed(2)})`" class="no-select" />
  </debounced-slider>
  <debounced-slider v-slot="{value}" v-model="drawMetalness"
                      :min="0" :max="1" :step="0.1" class="ml-2 mt-4">
    <v-label :text="`Metalness (${value.toFixed(2)})`" class="no-select" />
  </debounced-slider>
</v-container>
</template>
