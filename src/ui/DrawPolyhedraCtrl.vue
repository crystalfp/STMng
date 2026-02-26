<script setup lang="ts">
/**
 * @component
 * Controls for the polyhedra visualizer.
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
import {ref, reactive, watch, onUnmounted} from "vue";
import {askNode, sendToNode, receivePolyhedraFromNode} from "@/services/RoutesClient";
import {showSystemAlert} from "@/services/AlertMessage";
import {DrawPolyhedraRenderer} from "@/renderers/DrawPolyhedraRenderer";

import ColorSelector from "@/widgets/ColorSelector.vue";
import AtomsChooser from "@/widgets/AtomsChooser.vue";
import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";
import type {AtomSelectorModes} from "@/types";
import TitledSlot from "@/widgets/TitledSlot.vue";

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
const labelKind = ref<AtomSelectorModes>("symbol");
const atomsSelector = ref("");
const colorByCenterAtom = ref(false);
const opacityByCenterAtom = ref(0.5);
const showOpacity = ref(0.5);

const constrains = reactive({type: "any", count: 4, showCount: 4});


// > Initialize ui
askNode(id, "init")
    .then((params) => {

		surfaceColor.value = params.color as string ?? "#FFFFFF80";
		labelKind.value = params.labelKind as AtomSelectorModes ?? "symbol";
		atomsSelector.value = params.atomsSelector as string ?? "";
		showPolyhedra.value = params.showPolyhedra as boolean ?? true;
		colorByCenterAtom.value = params.colorByCenterAtom as boolean ?? true;
		opacityByCenterAtom.value = params.opacityByCenterAtom as number ?? 0.5;

        constrains.type = params.constrainVertices as string ?? "any";
        const count = params.countVertices as number ?? 4;
        constrains.count = count;
        constrains.showCount = count;
    })
    .catch((error: Error) => {
        showSystemAlert(`Error from UI init for ${label}: ${error.message}`);
    });

// > Initialize graphical rendering
const renderer = new DrawPolyhedraRenderer(id);

// > React to changes
const stopWatcher1 = watch([showPolyhedra, surfaceColor, colorByCenterAtom, opacityByCenterAtom], () => {

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


const stopWatcher2 = watch([constrains], () => {

    sendToNode(id, "constrain", {
        constrainVertices: constrains.type,
        countVertices: constrains.count,
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


// Cleanup
onUnmounted(() => {
    stopWatcher1();
    stopWatcher2();
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showPolyhedra" label="Show polyhedra & triangles" class="mt-4 ml-1" />
  <v-switch v-model="colorByCenterAtom" label="Color by center atom" class="mb-6 ml-1" />
  <atoms-chooser :id v-model:kind="labelKind" v-model:selector="atomsSelector"
                 channel="select" class="ml-0 mb-n2"
                 title="Select central atoms by"
                 placeholder="Central atoms selector"/>
  <slider-with-steppers v-if="colorByCenterAtom" v-model="opacityByCenterAtom"
                          v-model:raw="showOpacity" label-width="7rem" class="ml-1"
                          :label="`Opacity (${showOpacity.toFixed(1)})`"
                          :min="0" :max="1" :step="0.1" />
  <color-selector v-else v-model="surfaceColor" label="Surface color"
                  :transparency="true" class="ml-n2 mt-n4"/>

  <titled-slot title="Constrain vertex count" class="mt-6 mb-2 ml-1">
    <v-btn-toggle v-model="constrains.type" mandatory>
      <v-btn value="any">Any</v-btn>
      <v-btn value="exact">Exact</v-btn>
      <v-btn value="min">At least</v-btn>
    </v-btn-toggle>
  </titled-slot>
  <slider-with-steppers v-if="constrains.type !== 'any'" v-model="constrains.count"
                          v-model:raw="constrains.showCount" label-width="6rem"
                          :label="`Vertices (${constrains.showCount.toFixed(0)})`"
                          :min="3" :max="20" :step="1" />
</v-container>
</template>
