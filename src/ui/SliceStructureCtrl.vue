<script setup lang="ts">
/**
 * @component
 * Controls for the slice structure node.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-04-09
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {ref, reactive, watch, watchEffect, onUnmounted} from "vue";
import {askNode, sendToNode} from "@/services/RoutesClient";
import {showNodeAlert, resetNodeAlert} from "@/services/AlertMessage";
import AtomsChooser from "@/widgets/AtomsChooser.vue";
import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";
import NodeAlert from "@/widgets/NodeAlert.vue";
import {SliceStructureRenderer} from "@/renderers/SliceStructureRenderer";
import type {CtrlParams, SlicingModes, AtomSelectorModes} from "@/types";

import BlockButton from "@/widgets/BlockButton.vue";
import ColorSelector from "@/widgets/ColorSelector.vue";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// > Initialization
const enableSlicer = ref(false);
const showSlicer = ref(false);
const sliceInside = ref(false);
const mode = ref<SlicingModes>("plane");
const geometryColor = ref("#FFFFFF80");

/** Available modes */
const modeList = reactive<{label: string; value: SlicingModes}[]>([
    {label: "Plane",    value: "plane"},
    {label: "Miller",   value: "miller"},
    {label: "Sphere",   value: "sphere"},
    {label: "Slab",     value: "slab"},
    {label: "Direct",   value: "direct"},
    {label: "Bonded",   value: "bonded"},
]);

/** Sphere cut */
const selectorKind = ref<AtomSelectorModes>("symbol");
const atomsSelector = ref("");
const sphereRadius = ref(1);
const showSphereRadius = ref(1);

/** Plane cut */
const parallelA = ref(false);
const percentA = ref(50);
const showPercentA = ref(50);
const parallelB = ref(false);
const percentB = ref(50);
const showPercentB = ref(50);
const parallelC = ref(false);
const percentC = ref(50);
const showPercentC = ref(50);

/** Miller plane cut */
const millerH = ref(1);
const showMillerH = ref(1);
const millerK = ref(0);
const showMillerK = ref(0);
const millerL = ref(0);
const showMillerL = ref(0);
const millerPlaneOffset = ref(0);
const showMillerPlaneOffset = ref(0);

/** Slab cut (plane cut plus these) */
const thickness = ref(1);
const showThickness = ref(1);

// > Initialize ui
resetNodeAlert();

askNode(id, "init")
    .then((params) => {

		enableSlicer.value = params.enableSlicer as boolean ?? false;
		showSlicer.value = params.showSlicer as boolean ?? false;
		sliceInside.value = params.sliceInside as boolean ?? false;
		mode.value = params.mode as SlicingModes ?? "plane";
        parallelA.value = params.parallelA as boolean ?? false;
        percentA.value = params.percentA as number ?? 50;
        parallelB.value = params.parallelB as boolean ?? false;
        percentB.value = params.percentB as number ?? 50;
        parallelC.value = params.parallelC as boolean ?? false;
        percentC.value = params.percentC as number ?? 50;
        millerH.value = params.millerH as number ?? 1;
        millerK.value = params.millerK as number ?? 0;
        millerL.value = params.millerL as number ?? 0;
        millerPlaneOffset.value = params.millerPlaneOffset as number ?? 0;
        selectorKind.value = params.selectorKind as AtomSelectorModes ?? "symbol";
		atomsSelector.value = params.atomsSelector as string ?? "";
        sphereRadius.value = params.sphereRadius as number ?? 1;
        thickness.value = params.thickness as number ?? 1;
        geometryColor.value = params.geometryColor as string ?? "#FFFFFF80";

        showPercentA.value = percentA.value;
        showPercentB.value = percentB.value;
        showPercentC.value = percentC.value;
        showMillerH.value = millerH.value;
        showMillerK.value = millerK.value;
        showMillerL.value = millerL.value;
        showMillerPlaneOffset.value = millerPlaneOffset.value;
        showSphereRadius.value = sphereRadius.value;
        showThickness.value = thickness.value;
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from UI init for ${label}: ${error.message}`, "slicer");
    });

// > Initialize graphical rendering
const renderer = new SliceStructureRenderer(id);

/** Change parameters for sphere slice */
const stopWatcher1 = watch([enableSlicer, mode, selectorKind, atomsSelector,
       sphereRadius, sliceInside, showSlicer], () => {

    if((!enableSlicer.value && !showSlicer.value) || mode.value !== "sphere") return;

    askNode(id, "sphere", {
        atomsSelector: atomsSelector.value,
        selectorKind: selectorKind.value,
        sphereRadius: sphereRadius.value,
        sliceInside: sliceInside.value,
        showSlicer: showSlicer.value,
        enableSlicer: enableSlicer.value
    })
    .then((response: CtrlParams) => {
        renderer.drawSpheres(response.renderingParams as number[],
                             sphereRadius.value,
                             showSlicer.value);
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from UI sphere for ${label}: ${error.message}`, "slicer");
    });
});

/** Selected plane slice */
const stopWatcher2 = watch([enableSlicer, mode, parallelA, percentA, parallelB, percentB,
       parallelC, percentC, sliceInside, showSlicer], () => {

    if((!enableSlicer.value && !showSlicer.value) || mode.value !== "plane") return;

    askNode(id, "plane", {
        parallelA: parallelA.value,
        percentA: percentA.value,
        parallelB: parallelB.value,
        percentB: percentB.value,
        parallelC: parallelC.value,
        percentC: percentC.value,
        sliceInside: sliceInside.value,
        showSlicer: showSlicer.value,
        enableSlicer: enableSlicer.value
    })
    .then((response: CtrlParams) => {
        renderer.drawIntersectedPlane(response.intersections as number[], showSlicer.value);
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from UI plane for ${label}: ${error.message}`, "slicer");
    });
});

/** Slice along a slab */
const stopWatcher3 = watch([enableSlicer, mode, parallelA, percentA, parallelB, percentB,
       parallelC, percentC, thickness, sliceInside, showSlicer], () => {

    if((!enableSlicer.value && !showSlicer.value) || mode.value !== "slab") return;

    askNode(id, "slab", {
        parallelA: parallelA.value,
        percentA: percentA.value,
        parallelB: parallelB.value,
        percentB: percentB.value,
        parallelC: parallelC.value,
        percentC: percentC.value,
        thickness: thickness.value,
        sliceInside: sliceInside.value,
        showSlicer: showSlicer.value,
        enableSlicer: enableSlicer.value
    })
    .then((response) => {
        renderer.drawIntersectedPlane(response.intersections1 as number[], showSlicer.value);
        renderer.drawIntersectedPlane(response.intersections2 as number[], showSlicer.value, true);
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from UI slab for ${label}: ${error.message}`, "slicer");
    });
});

/** Slice along a Miller plane */
const stopWatcher4 = watch([enableSlicer, mode, millerH, millerK, millerL,
       millerPlaneOffset, sliceInside, showSlicer], () => {

    if((!enableSlicer.value && !showSlicer.value) || mode.value !== "miller") return;

    askNode(id, "miller", {
        millerH: millerH.value,
        millerK: millerK.value,
        millerL: millerL.value,
        millerPlaneOffset: millerPlaneOffset.value,
        sliceInside: sliceInside.value,
        showSlicer: showSlicer.value,
        enableSlicer: enableSlicer.value
    })
    .then((response: CtrlParams) => {
        renderer.drawIntersectedPlane(response.intersections as number[], showSlicer.value);
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from UI Miller plane for ${label}: ${error.message}`,
                      "slicer");
    });
});

/** Change parameters for direct atoms slicer */
const stopWatcher5 = watch([enableSlicer, mode, selectorKind,
       atomsSelector, sliceInside], () => {

    if(!enableSlicer.value) return;

    if(mode.value === "direct") {
        sendToNode(id, "direct", {
            sliceInside: sliceInside.value,
            atomsSelector: atomsSelector.value,
            selectorKind: selectorKind.value,
            enableSlicer: enableSlicer.value
        });
    }
    else if(mode.value === "bonded") {
        sendToNode(id, "bonded", {
            sliceInside: sliceInside.value,
            atomsSelector: atomsSelector.value,
            selectorKind: selectorKind.value,
            enableSlicer: enableSlicer.value
        });
    }
    else return;
    showSlicer.value = false;
});

/** Set the other parameters */
const stopWatcher6 = watch([enableSlicer, showSlicer, mode, geometryColor], () => {

    sendToNode(id, "set", {
        enableSlicer: enableSlicer.value,
        showSlicer: showSlicer.value,
        mode: mode.value,
        geometryColor: geometryColor.value
    });
    renderer.setVisibility(showSlicer.value);
    renderer.setGeometryColor(geometryColor.value);
});

/**
 * Reset parameters to sane default
 */
const resetParameters = (): void => {

    parallelA.value = false;
    percentA.value = 50;
    showPercentA.value = 50;
    parallelB.value = false;
    percentB.value = 50;
    showPercentB.value = 50;
    parallelC.value = false;
    percentC.value = 50;
    showPercentC.value = 50;

    millerH.value = 1;
    showMillerH.value = 1;
    millerK.value = 0;
    showMillerK.value = 0;
    millerL.value = 0;
    showMillerL.value = 0;
    millerPlaneOffset.value = 0;
    showMillerPlaneOffset.value = 0;

    sphereRadius.value = 1;
    showSphereRadius.value = 1;

    thickness.value = 1;
    showThickness.value = 1;

    selectorKind.value = "symbol";
    atomsSelector.value = "";

    geometryColor.value = "#FFFFFF80";
};

/** Check parameters validity */
const stopWatcher7 = watchEffect(() => {

    if(parallelA.value && parallelB.value && parallelC.value) {
        showNodeAlert("Only one or two parallel directions can be selected", "slicer");
    }
    else if(percentA.value === 0 && percentB.value === 0 && percentC.value === 0) {
        showNodeAlert("At least one direction must be selected", "slicer");
    }
    else if(millerH.value === 0 && millerK.value === 0 && millerL.value === 0) {
        showNodeAlert("At least one miller index must be selected", "slicer");
    }
    else if(sphereRadius.value <= 0) {
        showNodeAlert("Sphere radius must be greater than zero", "slicer");
    }
    else if(thickness.value <= 0) {
        showNodeAlert("Slab thickness must be greater than zero", "slicer");
    }
});

// Cleanup
onUnmounted(() => {
    stopWatcher1();
    stopWatcher2();
    stopWatcher3();
    stopWatcher4();
    stopWatcher5();
    stopWatcher6();
    stopWatcher7();
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="enableSlicer" label="Enable slicer" class="mt-4 ml-1" />
  <v-switch v-model="showSlicer" :disabled="mode==='direct' || mode==='bonded'"
            label="Show slicer geometry" class="ml-1" />
  <v-switch v-model="sliceInside" label="Slice inside" class="mb-4 ml-1" />
  <v-select v-model="mode"
    :items="modeList"
    label="Slice mode"
    item-title="label"
    item-value="value"
    class="mb-6 mr-2" />
  <color-selector v-model="geometryColor" label="Slicer geometry color"
                  :transparency="true" class="ml-0 mt-n2"/>

  <v-container v-if="mode==='plane' || mode==='slab'" class="pa-0">
    <v-switch v-model="parallelA" label="Parallel to a" class="mt-2 ml-1" />
    <slider-with-steppers v-model="percentA" v-model:raw="showPercentA" class="ml-0"
                          :disabled="parallelA" label-width="5rem"
                          :label="`a (${showPercentA.toFixed(1)}%)`"
                          :min="-100" :max="100" :step="0.1" />
    <v-switch v-model="parallelB" label="Parallel to b" class="mt-2 ml-1" />
    <slider-with-steppers v-model="percentB" v-model:raw="showPercentB" class="ml-0"
                          :disabled="parallelB" label-width="5rem"
                          :label="`b (${showPercentB.toFixed(1)}%)`"
                          :min="-100" :max="100" :step="0.1" />
    <v-switch v-model="parallelC" label="Parallel to c" class="mt-2 ml-1" />
    <slider-with-steppers v-model="percentC" v-model:raw="showPercentC" class="ml-0"
                          :disabled="parallelC" label-width="5rem"
                          :label="`c (${showPercentC.toFixed(1)}%)`"
                          :min="-100" :max="100" :step="0.1" />
    <slider-with-steppers v-if="mode==='slab'" v-model="thickness"
                          v-model:raw="showThickness"
                          class="mt-6 ml-0" label-width="8rem"
                          :label="`Thickness (${showThickness.toFixed(1)})`"
                          :min="0.1" :max="10" :step="0.1" />
  </v-container>
  <v-container v-else-if="mode==='miller'" class="pa-0">
    <slider-with-steppers v-model="millerH"
                          v-model:raw="showMillerH" label-width="3rem" class="ml-0 mt-2"
                          :label="`h (${showMillerH.toFixed(0)})`"
                          :min="-9" :max="9" :step="1" />
    <slider-with-steppers v-model="millerK"
                          v-model:raw="showMillerK" label-width="3rem" class="ml-0"
                          :label="`k (${showMillerK.toFixed(0)})`"
                          :min="-9" :max="9" :step="1" />
    <slider-with-steppers v-model="millerL"
                          v-model:raw="showMillerL" label-width="3rem" class="ml-0"
                          :label="`l (${showMillerL.toFixed(0)})`"
                          :min="-9" :max="9" :step="1" />
    <slider-with-steppers v-model="millerPlaneOffset"
                          v-model:raw="showMillerPlaneOffset" label-width="6rem"
                          :label="`offset (${showMillerPlaneOffset.toFixed(1)})`"
                          :min="-10" :max="10" :step="0.1" class="mt-3 mb-4"/>
  </v-container>
  <v-container v-else-if="mode==='sphere'" class="pa-0">
    <atoms-chooser :id v-model:kind="selectorKind" v-model:selector="atomsSelector"
                      channel="check"
                      class="ml-0 mb-n2 mt-2" :hide="['all']"
                      title="Select center atom by" placeholder="Central atom selector" />
    <slider-with-steppers v-model="sphereRadius"
                          v-model:raw="showSphereRadius" label-width="7rem" class="ml-1"
                          :label="`Radius (${showSphereRadius.toFixed(1)})`"
                          :min="0.1" :max="50" :step="0.1" />
  </v-container>
  <v-container v-else-if="mode==='direct' || mode==='bonded'" class="pa-0 pt-2">
    <atoms-chooser :id v-model:kind="selectorKind" v-model:selector="atomsSelector"
                   channel="check" class="ml-0 mb-n4" :hide="['all']"
                   title="Select atoms by" placeholder="Atom selector" />
  </v-container>
  <block-button class="mt-4" label="Reset parameters" @click="resetParameters"/>

  <node-alert node="slicer" />

</v-container>
</template>
