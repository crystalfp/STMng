<script setup lang="ts">
/**
 * @component
 * Select the set of atom data to use.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-05-03
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
import {ref, computed, reactive, watch, onUnmounted, toRaw} from "vue";
import {askNode, sendToNode} from "@/services/RoutesClient";
import {showNodeAlert} from "@/services/AlertMessage";
import type {AtomInfo} from "@/electron/modules/AtomData";

// > Events
const emit = defineEmits<{
	/** Communicate with the parent component to close this component */
	"close-panel": [];
}>();

const usingDefault = ref(true);
const isOpen = ref(true);
const atomData = reactive<AtomInfo[]>([]);

/** Initial data loading */
askNode("ATOM-DATA", "GET")
    .then((params) => {
        usingDefault.value = params.useDefault as boolean ?? true;
        const dataRaw = JSON.parse(params.data as string ?? "[]") as AtomInfo[];
        atomData.length = 0;
        for(const entry of dataRaw) atomData.push(entry);
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from set atom data initialization: ${error.message}`,
                      "selectAtomData");
    });

/**
 * Close the dialog discarding all modifications
 */
const closeDialog = (): void => {
    isOpen.value = false;
    emit("close-panel");
};

/**
 * Save modifications into an user data set
 */
const saveDialog = (): void => {
    usingDefault.value = false;
    sendToNode("ATOM-DATA", "SET", {
        useDefault: false,
        data: JSON.stringify(toRaw(atomData))
    });
    isOpen.value = false;
    emit("close-panel");
};

// TBD
const resetDialog = (): void => {
  askNode("ATOM-DATA", "GET")
  .then((params) => {
      usingDefault.value = params.useDefault as boolean ?? true;
      const dataRaw = JSON.parse(params.data as string ?? "[]") as AtomInfo[];
      atomData.length = 0;
      for(const entry of dataRaw) atomData.push(entry);
  })
  .catch((error: Error) => {
      showNodeAlert(`Error from set atom data initialization: ${error.message}`,
                    "selectAtomData");
  });
};

/** Which set is loaded */
const currentSet = computed(() => (usingDefault.value ?
                                              "Using default atom data" :
                                              "Using user atom data"));

/**
 * Compute the visual size of the atom representation
 * The size goes from 20px (rCov 0.32) to 70px (rCov 2.25)
 *
 * @param rCov - Covalent radius
 * @returns Size as CSS pixels string
 */
const radius = (rCov: number): string => {

    const d = 20+50*(rCov-0.32)/(2.25-0.32);
    return `${Math.round(d)}px`;
};

/** Currently selected atom */
const currentIdx = ref(0);
const currentAtom = reactive({
    symbol: "H",
    color: "#FFFFFF",
    rCov: 0.32,
    rVdW: 2,
    bondStrength: 0.5
});
const stopWatcher = watch(currentAtom, () => {

    const entry = atomData[currentIdx.value];
    entry.color = currentAtom.color;
    entry.rCov = currentAtom.rCov;
    entry.rVdW = currentAtom.rVdW;
    entry.bondStrength = currentAtom.bondStrength;
});

// Cleanup
onUnmounted(() => {
    stopWatcher();
});

/**
 * Select one atom type
 *
 * @param idx - Selected entry index
 */
const select = (idx: number): void => {

    currentIdx.value = idx;
    const entry = atomData[idx];
    currentAtom.color = entry.color;
    currentAtom.symbol = entry.symbol;
    currentAtom.rCov = entry.rCov;
    currentAtom.rVdW = entry.rVdW;
    currentAtom.bondStrength = entry.bondStrength;
};

</script>


<template>
<v-dialog v-model="isOpen" width="1200px">
  <v-card title="Edit atom data" :subtitle="currentSet">
    <v-card-text class="atom-data-container">
      <div class="ls">
        <div class="ls-container">
          <span v-for="(value, idx) in atomData" :key="value.symbol" v-ripple class="entry"
                @click="select(idx)">
            <div :style="{backgroundColor: value.color, width: radius(value.rCov), height: radius(value.rCov)}" class="atom">&nbsp;</div>
            <div class="type">{{ value.symbol }}</div>
          </span>
        </div>
      </div>
      <div class="rt">
        <v-label class="mb-1">{{ `Symbol: ${currentAtom.symbol}` }}</v-label>
        <v-color-picker v-model="currentAtom.color" :modes="['hex']" elevation="0" />
        <v-row>
          <v-col cols="8" class="mt-2">
            <v-label>Covalent radius:</v-label>
          </v-col>
          <v-col>
            <v-number-input v-model="currentAtom.rCov"
                            :min="0.1" :max="3" :step="0.01" :precision="2"/>
          </v-col>
        </v-row>
        <v-row class="mt-n4">
          <v-col cols="8" class="mt-2">
            <v-label>Van der Waals radius:</v-label>
          </v-col>
          <v-col>
            <v-number-input v-model="currentAtom.rVdW"
                            :min="0.1" :max="3" :step="0.01" :precision="2"/>
          </v-col>
        </v-row>
        <v-row class="mt-n4">
          <v-col cols="8" class="mt-2">
            <v-label>Bond strength:</v-label>
          </v-col>
          <v-col>
            <v-number-input v-model="currentAtom.bondStrength"
                            :min="0.01" :max="1" :step="0.01" :precision="2"/>
          </v-col>
        </v-row>
      </div>
      <div class="rb">
        hello
      </div>
    </v-card-text>
    <v-card-actions>
      <v-btn @click="resetDialog">Reset</v-btn>
      <v-btn @click="saveDialog">Save</v-btn>
      <v-btn v-focus @click="closeDialog">Close</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
</template>

<style scoped>
.atom-data-container {
  display: grid;
  gap: 0 5px;
  grid-auto-flow: row;
  grid-template:
    "ls rt" 1fr
    "ls rb" 0.2fr / 1fr 0.3fr;
  width: 100%;
  height: 800px;
  padding: 10px 10px 10px 15px;
}

.ls {grid-area: ls;}
.rt {grid-area: rt;}
.rb {grid-area: rb; background-color: navajowhite; color: black}

.ls-container {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-wrap: wrap;
}

.entry {
  border: 1px solid light-dark(#3e3e3e, #b0b0b0);
  width: 100px;
  height: 110px;
  flex: auto;
  padding-top: 5px;
  cursor: pointer;
}

.atom {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  margin: auto;
  border: 1px solid #3e3e3e;
}

.type {
  width: 100%;
  text-align: center;
  margin-top: 5px
}
</style>
