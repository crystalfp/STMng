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
const spheresRadiusMultiplier = ref(1);

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
        bondsRadiusMultiplier.value = params.bondsRadiusMultiplier as number ?? 1;
        spheresRadiusMultiplier.value = params.spheresRadiusMultiplier as number ?? 1;

        controlStore.legend = params.legend as boolean ?? false;
    })
    .catch((error: Error) => {
        showSystemAlert(`Error from UI init for ${label}: ${error.message}`);
    });

// > Initialize graphical rendering
const renderer = new DrawStructureRenderer(id, drawQuality.value,
				                                   drawRoughness.value,
                                           drawMetalness.value);

/**
 * Convert rg color into linear color space
 *
 * @param color - Color to be converted
 */
const rgb2linear = (color: string): string => {

    const r = Number.parseInt(color.slice(1, 3), 16)/255;
    const g = Number.parseInt(color.slice(3, 5), 16)/255;
    const b = Number.parseInt(color.slice(5, 7), 16)/255;

    const rl = (r < 0.04045) ? r * 0.0773993808 : Math.pow(r * 0.9478672986 + 0.0521327014, 2.4);
    const gl = (g < 0.04045) ? g * 0.0773993808 : Math.pow(g * 0.9478672986 + 0.0521327014, 2.4);
    const bl = (b < 0.04045) ? b * 0.0773993808 : Math.pow(b * 0.9478672986 + 0.0521327014, 2.4);

    const rs = Math.round(rl*255).toString(16).padStart(2, "0");
    const gs = Math.round(gl*255).toString(16).padStart(2, "0");
    const bs = Math.round(bl*255).toString(16).padStart(2, "0");

    return `#${rs}${gs}${bs}`;
};

/**
 * Prepare the legend for the count number of bonds
 *
 * @param info - Structure date for the renderer
 */
const prepareLegend = (info: StructureRenderInfo): void => {

    const {bonds, atoms} = info;
    const counts = new Map<number, number>();
    for(const bond of bonds) {
        let n = counts.get(bond.from);
        counts.set(bond.from, n ? n+1 : 1);
        n = counts.get(bond.to);
        counts.set(bond.to, n ? n+1 : 1);
    }
    let minBonds = Number.POSITIVE_INFINITY;
    let maxBonds = 0;
    for(const count of counts.values()) {
        if(count > maxBonds) maxBonds = count;
        if(count < minBonds) minBonds = count;
    }
    const natoms = atoms.length;
    for(let i=0; i < natoms; ++i) {
        if(!counts.has(i)) {
            minBonds = 0;
            break;
        }
    }

    const colors = renderer.getNumBondsColors();
    let plus = false;
    if(maxBonds > colors.length) {
        maxBonds = colors.length;
        plus = true;
    }

    controlStore.legendDiscrete.length = 0;
    for(let i=minBonds; i <= maxBonds; ++i) {
        controlStore.legendDiscrete.push({
            color: rgb2linear(colors[i]),
            label: plus && i === maxBonds ? `${i}+` : i.toString()
        });
    }
};

// Receive new structure from main process
receiveFromNodeForRendering(id, "structure", (updatedRenderInfo: StructureRenderInfo) => {

    renderInfo = updatedRenderInfo;
    renderer.adjustMaterials(drawQuality.value, drawRoughness.value,
                             drawMetalness.value);
    renderer.drawStructure(renderInfo, drawKind.value, shadedBonds.value,
                           showBondsStrengths.value, atomColoring.value,
                           monochromeColor.value, bondsRadiusMultiplier.value,
                           spheresRadiusMultiplier.value);
    renderer.drawLabels(renderInfo, showLabels.value, drawKind.value,
                        labelKind.value, bondsRadiusMultiplier.value,
                        spheresRadiusMultiplier.value);

    // Save basis to orient camera along cell sides
    for(let i=0; i < 9; ++i) controlStore.basis[i] = renderInfo.cell.basis[i];

    // Prepare data for the legend
    prepareLegend(renderInfo);
});

// Change draw parameters
watch([labelKind, drawKind, shadedBonds, showBondsStrengths, spheresRadiusMultiplier,
       bondsRadiusMultiplier, atomColoring, monochromeColor], () => {

    if(renderInfo) {
        renderer.drawStructure(renderInfo, drawKind.value, shadedBonds.value,
                               showBondsStrengths.value, atomColoring.value,
                               monochromeColor.value, bondsRadiusMultiplier.value,
                               spheresRadiusMultiplier.value);
        renderer.drawLabels(renderInfo, showLabels.value, drawKind.value,
                            labelKind.value, bondsRadiusMultiplier.value,
                            spheresRadiusMultiplier.value);
    }
    sendToNode(id, "save", {
        labelKind: labelKind.value,
        drawKind: drawKind.value,
        shadedBonds: shadedBonds.value,
        showBondsStrengths: showBondsStrengths.value,
        atomColoring: atomColoring.value,
        monochromeColor: monochromeColor.value,
        bondsRadiusMultiplier: bondsRadiusMultiplier.value,
        spheresRadiusMultiplier: spheresRadiusMultiplier.value,
        legend: controlStore.legend
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

const disableSphereMultiplier = computed(() =>
    drawKind.value !== "ball-and-stick"
);

// Show legend only when required
const showLegend = ref(false);
watch([showLegend, atomColoring], (after: [boolean, string]) => {
    controlStore.legend = after[0] && after[1] === "bonds";
});

</script>


<template>
<v-container class="container">
  <titled-slot title="Structure rendering mode" class="mt-4 mb-6 ml-2">
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
            label="Show bonds strengths" class="mt-n1 mb-3 ml-4" />
  <debounced-slider v-slot="{value}" v-model="bondsRadiusMultiplier" :disabled="disableShadedBonds"
                      :min="0.1" :max="2" :step="0.1" class="ml-2">
    <v-label :text="`Bonds radius multiplier (${value.toFixed(1)})`" class="no-select" />
  </debounced-slider>
  <debounced-slider v-slot="{value}" v-model="spheresRadiusMultiplier" :disabled="disableSphereMultiplier"
                      :min="0.1" :max="2" :step="0.1" class="ml-2 mt-2 mb-6">
    <v-label :text="`Sphere radius multiplier (${value.toFixed(1)})`" class="no-select" />
  </debounced-slider>

  <titled-slot title="Atom label" class="mb-2 ml-2">
    <v-btn-toggle v-model="labelKind" :disabled="!showLabels" mandatory>
      <v-btn value="symbol">Symbol</v-btn>
      <v-btn value="label">Label</v-btn>
      <v-btn value="index">Index</v-btn>
    </v-btn-toggle>
  </titled-slot>

  <titled-slot title="Atom color" class="ml-2">
    <v-btn-toggle v-model="atomColoring" :disabled="!showAtoms || drawKind === 'lines'" mandatory>
      <v-btn value="type">Type</v-btn>
      <v-btn value="mono">Mono</v-btn>
      <v-btn value="bonds">Bonds</v-btn>
    </v-btn-toggle>
    <template #extra>
      <color-selector v-if="atomColoring==='mono'" v-model="monochromeColor"
                      label="Atom mono color" class="mb-2" />
    </template>
  </titled-slot>
  <v-switch v-if="atomColoring==='bonds'" v-model="showLegend"
            class="ml-4 mb-8 mt-n6" label="Show legend" />

  <titled-slot title="Visibility" class="mb-2 ml-2 mt-n4">
    <v-btn-toggle v-model="showCombined" multiple>
      <v-btn value="atoms">Atoms</v-btn>
      <v-btn value="bonds">Bonds</v-btn>
      <v-btn value="labels">Labels</v-btn>
      <v-btn value="display" active>{{ showAll ? "Show" : "Hide" }}</v-btn>
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
