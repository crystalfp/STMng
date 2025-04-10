<script setup lang="ts">
/**
 * @component
 * Controls for the slice structure node.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-04-09
 */
import {ref, watch, watchEffect} from "vue";
import {askNode, sendToNode} from "@/services/RoutesClient";
import {showSystemAlert, showAlertMessage, resetAlertMessage} from "@/services/AlertMessage";
import AtomsChooser from "@/widgets/AtomsChooser.vue";
import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";
import ErrorAlert from "@/widgets/ErrorAlert.vue";
import {SliceStructureRenderer} from "@/renderers/SliceStructureRenderer";

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
const sliceOutside = ref(false);
const mode = ref("plane");

/** Sphere cut */
const selectorKind = ref("symbol");
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

/** Slab cut */
const thickness = ref(1);
const showThickness = ref(1);

// > Initialize ui
askNode(id, "init")
    .then((params) => {

		enableSlicer.value = params.enableSlicer as boolean ?? false;
		mode.value = params.mode as string ?? "plane";
        selectorKind.value = params.selectorKind as string ?? "symbol";
		atomsSelector.value = params.atomsSelector as string ?? "";
    })
    .catch((error: Error) => showSystemAlert(`Error from UI init for ${label}: ${error.message}`));

resetAlertMessage("slicer");

// > Initialize graphical rendering
const renderer = new SliceStructureRenderer(id);
void renderer; // TBD

watch([selectorKind, atomsSelector], () => {

    sendToNode(id, "select", {
        atomsSelector: atomsSelector.value,
        selectorKind: selectorKind.value
    });
});

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

    sphereRadius.value = 1;
    showSphereRadius.value = 1;

    thickness.value = 1;
    showThickness.value = 1;
};

watchEffect(() => {

    if(parallelA.value && parallelB.value && parallelC.value) {
      showAlertMessage("Only one or two parallel directions can be selected", "slicer");
    }
    else if(percentA.value === 0 && percentB.value === 0 && percentC.value === 0) {
      showAlertMessage("At least one direction must be selected", "slicer");
    }
    else if(millerH.value === 0 && millerK.value === 0 && millerL.value === 0) {
      showAlertMessage("At least one miller index must be selected", "slicer");
    }
    else if(sphereRadius.value <= 0) {
      showAlertMessage("Sphere radius must be greater than zero", "slicer");
    }
    else if(thickness.value <= 0) {
      showAlertMessage("Slab thickness must be greater than zero", "slicer");
    }
});

/*    sendToNode(id, "set", {
        enableSlicer: enableSlicer.value,
        showSlicer: showSlicer.value,
        sliceOutside: sliceOutside.value,
        mode: mode.value,
        parallelA: parallelA.value,
        percentA: percentA.value,
        parallelB: parallelB.value,
        percentB: percentB.value,
        parallelC: parallelC.value,
        percentC: percentC.value,
        millerH: millerH.value,
        millerK: millerK.value,
        millerL: millerL.value,
        sphereRadius: sphereRadius.value,
        thickness: thickness.value
    });
    */

</script>


<template>
<v-container class="container">
  <v-switch v-model="enableSlicer" label="Enable slicer" class="mt-2 ml-3" />
  <v-switch v-model="showSlicer" label="Show slicer" class="ml-3" />
  <v-switch v-model="sliceOutside" label="Slice outside" class="mb-4 ml-3" />
  <v-row class="mb-2">
    <v-col cols="12" class="pa-0 ml-5 mt-2 mb-n2">
      <v-label text="Mode" class="no-select" />
    </v-col>
    <v-col>
      <v-btn-toggle v-model="mode" mandatory class="mb-2 ml-2">
        <v-btn value="plane">Plane</v-btn>
        <v-btn value="miller">Miller</v-btn>
        <v-btn value="sphere">Sphere</v-btn>
        <v-btn value="slab">Slab</v-btn>
      </v-btn-toggle>
    </v-col>
  </v-row>
  <v-container v-if="mode==='plane' || mode==='slab'" class="pa-0">
    <v-switch v-model="parallelA" label="Parallel to a" class="mt-2 ml-4" />
    <slider-with-steppers v-model="percentA" :disabled="parallelA"
                          v-model:raw="showPercentA" label-width="5rem"
                          :label="`a (${showPercentA.toFixed(1)}%)`"
                          :min="-100" :max="100" :step="0.1" />
    <v-switch v-model="parallelB" label="Parallel to b" class="mt-2 ml-4" />
    <slider-with-steppers v-model="percentB" :disabled="parallelB"
                          v-model:raw="showPercentB" label-width="5rem"
                          :label="`b (${showPercentB.toFixed(1)}%)`"
                          :min="-100" :max="100" :step="0.1" />
    <v-switch v-model="parallelC" label="Parallel to c" class="mt-2 ml-4" />
    <slider-with-steppers v-model="percentC" :disabled="parallelC"
                          v-model:raw="showPercentC" label-width="5rem"
                          :label="`c (${showPercentC.toFixed(1)}%)`"
                          :min="-100" :max="100" :step="0.1" />
    <slider-with-steppers v-if="mode==='slab'" v-model="thickness" class="mt-2"
                          v-model:raw="showThickness" label-width="8rem"
                          :label="`Thickness (${showThickness.toFixed(1)})`"
                          :min="0.1" :max="10" :step="0.1" />
  </v-container>
  <v-container v-else-if="mode==='miller'" class="pa-0">
    <slider-with-steppers v-model="millerH"
                          v-model:raw="showMillerH" label-width="3rem"
                          :label="`h (${showMillerH.toFixed(0)})`"
                          :min="-9" :max="9" :step="1" />
    <slider-with-steppers v-model="millerK"
                          v-model:raw="showMillerK" label-width="3rem"
                          :label="`k (${showMillerK.toFixed(0)})`"
                          :min="-9" :max="9" :step="1" />
    <slider-with-steppers v-model="millerL"
                          v-model:raw="showMillerL" label-width="3rem"
                          :label="`l (${showMillerL.toFixed(0)})`"
                          :min="-9" :max="9" :step="1" />
  </v-container>
  <v-container v-else-if="mode==='sphere'" class="pa-0">
    <atoms-chooser v-model:kind="selectorKind" v-model:selector="atomsSelector"
                      class="ml-2 mb-6" :hide="['symbol', 'all']"
                      title="Select center atom by" placeholder="Central atom selector" />
    <slider-with-steppers v-model="sphereRadius"
                          v-model:raw="showSphereRadius" label-width="7rem"
                          :label="`Radius (${showSphereRadius.toFixed(1)})`"
                          :min="0.1" :max="50" :step="0.1" />
  </v-container>
  <v-btn block @click="resetParameters" class="mt-6">Reset parameters</v-btn>
  <error-alert kind="slicer" />
</v-container>
</template>
