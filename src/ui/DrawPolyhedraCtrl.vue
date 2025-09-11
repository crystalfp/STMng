<script setup lang="ts">
/**
 * @component
 * Controls for the polyhedra visualizer.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */

import {ref, watch} from "vue";
import {askNode, sendToNode, receivePolyhedraFromNode} from "@/services/RoutesClient";
import {showSystemAlert} from "@/services/AlertMessage";
import {DrawPolyhedraRenderer} from "@/renderers/DrawPolyhedraRenderer";

import ColorSelector from "@/widgets/ColorSelector.vue";
import AtomsChooser from "@/widgets/AtomsChooser.vue";
import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// > Initialization
const showPolyhedra = ref(true);
const surfaceColor = ref("#FFFFFF80");
const labelKind = ref("symbol");
const atomsSelector = ref("");
const colorByCenterAtom = ref(false);
const opacityByCenterAtom = ref(0.5);
const showOpacity = ref(0.5);

// > Initialize ui
askNode(id, "init")
    .then((params) => {

		surfaceColor.value = params.color as string ?? "#FFFFFF80";
		labelKind.value = params.labelKind as string ?? "symbol";
		atomsSelector.value = params.atomsSelector as string ?? "";
		showPolyhedra.value = params.showPolyhedra as boolean ?? true;
		colorByCenterAtom.value = params.colorByCenterAtom as boolean ?? true;
		opacityByCenterAtom.value = params.opacityByCenterAtom as number ?? 0.5;
    })
    .catch((error: Error) => showSystemAlert(`Error from UI init for ${label}: ${error.message}`));

// > Initialize graphical rendering
const renderer = new DrawPolyhedraRenderer(id);

// > React to changes
watch([showPolyhedra, surfaceColor, colorByCenterAtom, opacityByCenterAtom], () => {

    sendToNode(id, "look", {
        showPolyhedra: showPolyhedra.value,
        color: surfaceColor.value,
        colorByCenterAtom: colorByCenterAtom.value,
        opacityByCenterAtom: opacityByCenterAtom.value
    });

    // If only visibility changes
    if(renderer.changeVisibility(showPolyhedra.value)) return;

    // Change material
    if(colorByCenterAtom.value) {
        renderer.changeOpacity(opacityByCenterAtom.value);
    }
    else {
        renderer.changeColor(surfaceColor.value);
    }

    // Redraw polyhedron
    renderer.drawPolyhedra(colorByCenterAtom.value, showPolyhedra.value);
});

watch([labelKind, atomsSelector], () => {

    sendToNode(id, "select", {
        atomsSelector: atomsSelector.value,
        labelKind: labelKind.value,
    });
});

/** Received vertex coordinates and colors */
receivePolyhedraFromNode(id, "vertices",
                         (vertices: number[][], centerAtomsColor: string[]) => {

    // Format the received data
    renderer.formatPolyhedraData(vertices, centerAtomsColor);

    // Render the polyhedron
    renderer.drawPolyhedra(colorByCenterAtom.value, showPolyhedra.value);
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showPolyhedra" label="Show polyhedra & triangles" class="mt-4 ml-4" />
  <v-switch v-model="colorByCenterAtom" label="Color by center atom" class="mb-6 ml-4" />
  <atoms-chooser v-model:kind="labelKind" v-model:selector="atomsSelector"
                 class="ml-2 mb-2"
                 title="Select central atoms by" placeholder="Central atoms selector" />
  <slider-with-steppers v-if="colorByCenterAtom" v-model="opacityByCenterAtom"
                          v-model:raw="showOpacity" label-width="7rem"
                          :label="`Opacity (${showOpacity.toFixed(1)})`"
                          :min="0" :max="1" :step="0.1" />
  <color-selector v-else v-model="surfaceColor" label="Surface color"
                  :transparency="true" block class="ml-n1 mt-n1"/>
</v-container>
</template>
