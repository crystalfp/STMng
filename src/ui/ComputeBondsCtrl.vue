<script setup lang="ts">
/**
 * @component
 * Controls for bonds computation.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-08-20
 */

import {computed, ref, reactive, watch} from "vue";
import {askNode, sendToNode, receiveFromNode} from "@/services/RoutesClient";
import {showSystemAlert} from "@/services/AlertMessage";
import {resetCamera} from "@/services/ResetCamera";
import type {CtrlParams} from "@/types";

import DebouncedSlider from "@/widgets/DebouncedSlider.vue";
import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";
import TitledSlot from "@/widgets/TitledSlot.vue";
import BlockButton from "@/widgets/BlockButton.vue";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

/**
 * Data for the bond computation by atom type pairs
 * @notExported
 */
interface PairData {
    /** Label containing the two atom symbols */
    label:  string;
    /** First atom Z value */
    atomZi: number;
    /** Second atom Z value */
    atomZj: number;
    /** Scale value for the bond computation */
    scale:  number;
}

const minBondingDistance  = ref(0.64);
const maxBondingDistance  = ref(4.50);
const bondScale           = ref(1.10);
const maxHBondingDistance = ref(3.00);
const maxHValenceAngle    = ref(30);
const enableComputeBonds  = ref(true);
const perPairScale        = ref(false);
const perPairData         = reactive<PairData[]>([]);
const showScale           = reactive<number[]>([]);
const enlargementKind     = ref("neighbors");

// Initialize the control
askNode(id, "init")
    .then((params) => {

        minBondingDistance.value  = params.minBondingDistance as number ?? 0.64;
        maxBondingDistance.value  = params.maxBondingDistance as number ?? 4.50;
        maxHBondingDistance.value = params.maxHBondingDistance as number ?? 3.00;
        maxHValenceAngle.value    = params.maxHValenceAngle as number ?? 30;
        enableComputeBonds.value  = params.enableComputeBonds as boolean ?? true;
        bondScale.value      	    = params.bondScale as number ?? 1.1;
        perPairScale.value        = params.perPairScale as boolean ?? false;
        enlargementKind.value     = params.enlargementKind as string ?? "neighbors";

        perPairData.length = 0;
        const pairData = JSON.parse(params.perPairData as string ?? "[]") as PairData[];
        for(const item of pairData) {
            perPairData.push(item);
            showScale.push(item.scale);
        }
    })
    .catch((error: Error) => {
        showSystemAlert(`Error from UI init for ${label}: ${error.message}`);
    });

const scales = computed((old?: number[]) => {

    const out: number[] = [];
    for(const pair of perPairData) {
        out.push(pair.scale);
    }

    // To avoid changes if nothing changed
    if(old?.length === out.length) {
        for(let i=0; i < old.length; ++i) {
            if(old[i] !== out[i]) return out;
        }
        return old;
    }
    return out;
});

watch([minBondingDistance, maxBondingDistance, maxHBondingDistance,
       maxHValenceAngle, enableComputeBonds, bondScale, perPairScale,
       scales, enlargementKind], (
        [aminbd, amaxbd, amaxhbd, amaxva, aen, abs, apps, as, aek],
        [bminbd, bmaxbd, bmaxhbd, bmaxva, ben, bbs, bpps, bs, bek]
       ) => {

    // Workaround to avoid firing with no value changed
    let changes = false;
    if(aminbd  !== bminbd ||
       amaxbd  !== bmaxbd ||
       amaxhbd !== bmaxhbd ||
       amaxva  !== bmaxva ||
       aen     !== ben ||
       abs     !== bbs ||
       apps    !== bpps ||
       aek     !== bek) {
        changes = true;
    }
    else if(apps) {
        const len = perPairData.length;
        for(let i=0; i < len; ++i) {
            if(as[i] !== bs[i]) {
                changes = true;
                break;
            }
        }
    }

    if(changes) sendToNode(id, "changes", {
        minBondingDistance:  minBondingDistance.value,
        maxBondingDistance:  maxBondingDistance.value,
        maxHBondingDistance: maxHBondingDistance.value,
        maxHValenceAngle:    maxHValenceAngle.value,
        enableComputeBonds:  enableComputeBonds.value,
        bondScale:           bondScale.value,
        perPairScale:        perPairScale.value,
        perPairData:         JSON.stringify(perPairData),
        enlargementKind:     enlargementKind.value
    });
}, {deep: true});

watch(enlargementKind, () => resetCamera());

receiveFromNode(id, "params", (params: CtrlParams) => {

    if(params.enableComputeBonds !== undefined) {
	    enableComputeBonds.value = params.enableComputeBonds as boolean ?? false;
        const maxAtoms = params.maxAtoms as number ?? 0;
        const mm = maxAtoms > 0 ? `More than ${maxAtoms} atoms` : "Too many atoms";
        showSystemAlert(`${mm}. Disabled bonds computation`, "warning");
    }
    if(params.perPairData !== undefined) {
        perPairData.length = 0;
        const pairData = JSON.parse(params.perPairData as string ?? "[]") as PairData[];
        for(const item of pairData) {
            perPairData.push(item);
            showScale.push(item.scale);
        }
    }
});

/**
 * Reset sliders and enlargement kind to default values
 */
const resetSliders = (): void => {
    minBondingDistance.value  = 0.64;
    maxBondingDistance.value  = 4.50;
    maxHBondingDistance.value = 3.00;
    maxHValenceAngle.value    = 30;
    bondScale.value           = 1.1;
    let i = 0;
    for(const item of perPairData) {
        item.scale = 1.1;
        showScale[i] = 1.1;
        ++i;
    }
    enlargementKind.value = "neighbors";
};

</script>


<template>
<v-container class="container">

  <v-switch v-model="enableComputeBonds"
            label="Enable compute bonds" class="my-4 ml-2" />

  <debounced-slider v-slot="{value}" v-model="minBondingDistance" :min="0.6" :max="1" :step="0.01"
                      class="ml-2 mb-2 mt-1">
    <v-label :text="`Bonding min distance (${value.toFixed(2)})`" class="no-select" />
  </debounced-slider>
  <debounced-slider v-slot="{value}" v-model="maxBondingDistance" :min="2.0" :max="5.0" :step="0.01"
                      class="ml-2 mb-2">
    <v-label :text="`Bonding max distance (${value.toFixed(2)})`" class="no-select" />
  </debounced-slider>
  <debounced-slider v-slot="{value}" v-model="maxHBondingDistance" :min="2.5" :max="4.0" :step="0.01"
                      class="ml-2 mb-2">
    <v-label :text="`H Bonding max distance (${value.toFixed(2)})`" class="no-select" />
  </debounced-slider>
  <debounced-slider v-slot="{value}" v-model="maxHValenceAngle" :min="0" :max="45" :step="1" class="ml-2 mb-4">
    <v-label :text="`H Bonding max valence angle (${value.toFixed(2)})`" class="no-select" />
  </debounced-slider>
  <v-label class="ml-2 no-select">Sum of covalent radii multiplier</v-label>
  <v-switch v-model="perPairScale" :disabled="perPairData.length < 2"
            label="Multiplier per atom pair" class="ml-2 mt-2 mb-4" />
  <v-container v-if="perPairScale" class="pa-0">
    <v-table class="px-2 py-1">
      <tr v-for="(item, idx) of perPairData" :key="item.label" class="per-pair-row">
        <td class="first-column">{{ item.label }}</td>
        <td><slider-with-steppers v-model="item.scale" v-model:raw="showScale[idx]"
                                    :label="`(${showScale[idx].toFixed(2)})`" label-width="3rem"
                                    :min="0" :max="3.0" :step="0.01" class="mr-0"/></td>
      </tr>
    </v-table>
  </v-container>
  <v-container v-else class="pa-0 mt-n3">
    <debounced-slider v-slot="{value}" v-model="bondScale" :min="0" :max="3.0" :step="0.01" class="ml-2">
      <v-label :text="`For all atom pairs (${value.toFixed(2)})`" class="no-select" />
    </debounced-slider>
  </v-container>

  <titled-slot title="Add bonded atoms outside unit cell" class="mt-4 mb-2 ml-2">
    <v-btn-toggle v-model="enlargementKind" mandatory>
      <v-btn value="none">None</v-btn>
      <v-btn value="neighbors">Neighbors</v-btn>
      <v-btn value="connected">Full</v-btn>
      <v-btn value="polyhedra">Poly</v-btn>
    </v-btn-toggle>
  </titled-slot>

  <block-button @click="resetSliders" label="Reset parameters"/>

</v-container>
</template>

<style scoped>
:deep(.v-table__wrapper) {
  overflow-y: hidden
}

/* Setting to have over effect in table */
.per-pair-row {
  opacity: 0.6;
}

.per-pair-row:hover {
  opacity: 1;
}

.first-column {
  width: 4rem
}
</style>
