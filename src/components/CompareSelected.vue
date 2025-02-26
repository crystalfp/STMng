<script setup lang="ts">
/**
 * @component
 * Compare two structures selected in the scatterplot.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-02-24
 */
import {ref} from "vue";
import log from "electron-log";
import {theme} from "@/services/ReceiveTheme";
import {closeWindow, receiveInWindow, sendToNode} from "@/services/RoutesClient";

/** List of structures to compare */
interface Selection {

    /** Structure step */
    step: number;

    /** Selected on the left column */
    selected0: boolean;

    /** Selected on the right column */
    selected1: boolean;

    /** Disabled on the left column */
    disabled0: boolean;

    /** Disabled on the right column */
    disabled1: boolean;
}
const lines = ref<Selection[]>([]);

/** The selected step on the two columns */
const selectedStep0 = ref(-1);
const selectedStep1 = ref(-1);

// TBD Mocked functions
const loadStructure = (side: 0 | 1, idx: number): void => {
    console.log("LOAD", side, idx);
};

const unloadStructure = (idx: number): void => {
    console.log("UNLOAD", idx);
};

/**
 * Send the updated selected steps list
 */
const updateSelection = (): void => {

    const steps = [];
    for(const entry of lines.value) steps.push(entry.step);
    sendToNode("SYSTEM", "updated-selection", {updatedStepsSelection: steps});
};

// Load values from main
receiveInWindow((dataFromMain) => {

    const steps = JSON.parse(dataFromMain) as number[];
    const len = steps.length;
    lines.value.length = 0;
    if(len === 0) return;
    for(let i=0; i < len; ++i) lines.value.push({
        step: steps[i], selected0: false, selected1: false, disabled0: false, disabled1: false
    });
});

/**
 * Convert step into a list position
 *
 * @param step - Step for which the position in list should be found
 * @returns The corresponding index
 */
const findIdx = (step: number): number => {

    const len = lines.value.length;
    for(let idx=0; idx < len; ++idx) {
        if(lines.value[idx].step === step) return idx;
    }
    log.error("Step not found");
    return 0;
};

/**
 * Enable all element of a column except the one provided
 *
 * @param side - Side of the list (0: left, 1: right)
 * @param idx - If set enable all elements except this one
 */
const enableAllExcept = (side: 0 | 1, idx?: number): void => {

    if(side) {
        for(const entry of lines.value) entry.disabled1 = false;
        if(idx !== undefined) lines.value[idx].disabled1 = true;
    }
    else {
        for(const entry of lines.value) entry.disabled0 = false;
        if(idx !== undefined) lines.value[idx].disabled0 = true;
    }
};

/**
 * Select one entry
 *
 * @param side - Side of the list (0: left, 1: right)
 * @param step - Step that has been selected
 */
const select = (side: 0 | 1, step: number): void => {

    const idx = findIdx(step);

    if(side) {
        if(step === selectedStep0.value) return;
        if(step === selectedStep1.value) {
            lines.value[idx].selected1 = false;
            selectedStep1.value = -1;
            unloadStructure(idx);
            enableAllExcept(0);
        }
        else if(selectedStep1.value === -1) {
            lines.value[idx].selected1 = true;
            selectedStep1.value = step;
            loadStructure(1, idx);
            enableAllExcept(0, idx);
        }
        else {
            const idx1 = findIdx(selectedStep1.value);
            lines.value[idx1].selected1 = false;
            unloadStructure(idx1);
            lines.value[idx].selected1 = true;
            selectedStep1.value = step;
            loadStructure(1, idx);
            enableAllExcept(0, idx);
        }
    }
    else {
        if(step === selectedStep1.value) return;
        if(step === selectedStep0.value) {
            lines.value[idx].selected0 = false;
            selectedStep0.value = -1;
            unloadStructure(idx);
            enableAllExcept(1);
        }
        else if(selectedStep0.value === -1) {
            lines.value[idx].selected0 = true;
            selectedStep0.value = step;
            loadStructure(0, idx);
            enableAllExcept(1, idx);
        }
        else {
            const idx0 = findIdx(selectedStep0.value);
            lines.value[idx0].selected0 = false;
            unloadStructure(idx0);
            lines.value[idx].selected0 = true;
            selectedStep0.value = step;
            loadStructure(0, idx);
            enableAllExcept(1, idx);
        }
    }
};

/**
 * Remove an entry from the list
 *
 * @param side - Remove the selected from the given side
 */
const remove = (side: 0 | 1): void => {

    let step;
    if(side) {
        if(selectedStep1.value === -1) return;
        step = selectedStep1.value;
        selectedStep1.value = -1;
        if(selectedStep0.value === step) {
            selectedStep0.value = -1;
        }
    }
    else {
        if(selectedStep0.value === -1) return;
        step = selectedStep0.value;
        selectedStep0.value = -1;
        if(selectedStep1.value === step) {
            selectedStep1.value = -1;
        }
    }

    const idx = findIdx(step);
    unloadStructure(idx);
    lines.value.splice(idx, 1);
    updateSelection();
};

// TBD
const showNotification = ref(true);
</script>


<template>
<v-app :theme="theme">
  <div class="compare-grid">
    <div class="side-w px-2">
      <v-label class="sub-tt separator-title first-title">Compare selected</v-label>
      <div class="sub-tl"></div>
      <div class="sub-tr"></div>
      <div class="sub-cl">
        <div v-for="line of lines" :key="line.step"
             class="entry" :class="{selected: line.selected0, disabled: line.disabled0}"
             @click="select(0, line.step)">{{ line.step }}</div>
      </div>
      <div class="sub-cr">
        <div v-for="line of lines" :key="line.step"
             class="entry" :class="{selected: line.selected1, disabled: line.disabled1}"
             @click="select(1, line.step)">{{ line.step }}</div>
      </div>
      <v-btn class="sub-bl" :disabled="selectedStep0 === -1" @click="remove(0)">Remove</v-btn>
      <v-btn class="sub-br" :disabled="selectedStep1 === -1" @click="remove(1)">Remove</v-btn>
    </div>
    <div class="side-n">
    </div>
    <div class="side-s">
      <v-btn v-focus @click="closeWindow('/compare')">Close</v-btn>
    </div>
  </div>
  <!-- TBD -->
  <v-snackbar v-model="showNotification" timer="info"
              close-on-content-click color="red">Not yet finished</v-snackbar>
</v-app>
</template>


<style scoped>
.compare-grid {
  display: grid;
  gap: 0;
  grid-auto-flow: row;
  grid-template:
    "aa bb" 1fr
    "aa cc" 50px / 360px 1fr;
  height: 100vh;
}

.side-w {
  grid-area: aa;
  display: grid;
  gap: 0 5px;
  grid-auto-flow: row;
  grid-template:
    "tt tt" 50px
    "tl tr" 20px
    "cl cr" 1fr
    "bl br" 45px / 1fr 1fr;
  height: 100vh;
}

.side-n {grid-area: bb; padding-top: 20px; background-color: #90CEEC;}

.side-s {
  grid-area: cc;
  justify-content: end;
  display: flex;
  align-items: center;
  max-width: 3000px !important;
  gap: 10px;
  padding-right: 10px !important;
  width: 100%
}

.sub-tt {grid-area: tt;}
.sub-tl {grid-area: tl; background-color: blue;}
.sub-tr {grid-area: tr; background-color: green;}
.sub-cl {grid-area: cl; overflow-y: auto; margin-bottom: 10px;}
.sub-cr {grid-area: cr; overflow-y: auto; margin-bottom: 10px;}
.sub-bl {grid-area: bl;}
.sub-br {grid-area: br;}

.selected {
  background-color: rgb(var(--v-theme-surface-variant), 0.3);
}
.disabled {
  color: light-dark(rgba(16, 16, 16, 0.3), rgba(255, 255, 255, 0.3));
}

.entry {
  cursor: pointer;
  text-align-last: right;
}
</style>
