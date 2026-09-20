<script setup lang="ts">
/**
 * Controls for the structure editor
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-08-17
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import {onUnmounted, watch, reactive, ref, computed} from "vue";
import {useControlStore} from "@/stores/controlStore";
import {useConfigStore} from "@/stores/configStore";
import {MeasuresRenderer} from "@/renderers/MeasuresRenderer";
import {askNode} from "@/services/RoutesClient";
import type {SelectedAtom} from "@/types";
import {resetNodeAlert, showNodeAlert, showSystemAlert} from "@/services/AlertMessage";
import BlockButton from "@/widgets/BlockButton.vue";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// > Access the stores
const controlStore = useControlStore();
const configStore = useConfigStore();

/** Renderer */
const renderer = new MeasuresRenderer(id);

interface AtomSymbol {
    title: string;
    value: number;
}
const details      = reactive<SelectedAtom[]>([]);
const atomTypes    = ref<AtomSymbol[]>([]);
const atomSelected = ref(false);

const editedAtom = reactive<{
    atomZ: number;
    atomLabel: string;
    chain: string;
    useFractional: boolean;
    x: number;
    y: number;
    z: number;
    fx: number;
    fy: number;
    fz: number;
}>({
    atomZ: 0,
    atomLabel: "",
    chain: "",
    useFractional: false,
    x: 0,
    y: 0,
    z: 0,
    fx: 0,
    fy: 0,
    fz: 0,
});

const modified = ref(false);

// Initialize the control
resetNodeAlert();
askNode(id, "init").then((params) => {

    const rawAtomsTypes = JSON.parse(params.atomTypes as string ?? "[]") as AtomSymbol[];
    atomTypes.value.length = 0;
    atomTypes.value.push({title: "", value: 0});
    for(const atom of rawAtomsTypes) atomTypes.value.push(atom);
})
.catch((error: Error) => {
    showNodeAlert(`Error from UI init for ${label}: ${error.message}`,
                  "editStructure");
});

// Watch atoms selection
const stopWatcher1 = watch(controlStore.atomsSelected, (a: number[]) => {

    if(a.length === 0) {
        renderer.clearOutput();
        details.length = 0;
        editedAtom.atomZ = 0;
        atomSelected.value = false;
        editedAtom.atomLabel = "";
        editedAtom.chain = "";
        editedAtom.x = 0;
        editedAtom.y = 0;
        editedAtom.z = 0;
        return;
    }
    atomSelected.value = true;

    askNode(id, "select", {
        idx: a.at(-1)!
    })
    .then((params) => {

        const rawDetails = JSON.parse(params.details as string ?? "[]") as SelectedAtom[];
        details.length = 0;
        for(const atom of rawDetails) details.push(atom);
        editedAtom.atomZ = params.atomZ as number ?? 0;
        editedAtom.atomLabel = details[0].label;
        editedAtom.chain = details[0].chain;
        const [x, y, z] = details[0].position;
        const [fx, fy, fz] = details[0].fractional;
        if(params.useFractional as boolean ?? false) {
            editedAtom.fx = fx;
            editedAtom.fy = fy;
            editedAtom.fz = fz;
        }
        else {
            editedAtom.x = x;
            editedAtom.y = y;
            editedAtom.z = z;
        }

        const pointSize = configStore.isPerspectiveCamera ? 0.3 : 6;
        renderer.measureAtoms(details, pointSize);
    })
    .catch((error: Error) => {
        showSystemAlert(`Error from selecting atom in ${label}: ${error.message}`);
    });
});

const changedUseFractional = (): void => {

    if(details.length === 0) {

        askNode(id, "convert", {
            useFractional: editedAtom.useFractional,
            x: editedAtom.x,
            y: editedAtom.y,
            z: editedAtom.z,
            fx: editedAtom.fx,
            fy: editedAtom.fy,
            fz: editedAtom.fz,
        })
        .then((response) => {
            if(editedAtom.useFractional) {
                editedAtom.fx = response.fx as number ?? 0;
                editedAtom.fy = response.fy as number ?? 0;
                editedAtom.fz = response.fz as number ?? 0;
            }
            else {
                editedAtom.x = response.x as number ?? 0;
                editedAtom.y = response.y as number ?? 0;
                editedAtom.z = response.z as number ?? 0;
            }
        })
        .catch((error: Error) => {
            showSystemAlert(`Error from converting coordinates in ${label}: ${error.message}`);
        });

        return;
    }

    const [x, y, z] = details[0].position;
    const [fx, fy, fz] = details[0].fractional;
    if(editedAtom.useFractional) {
        editedAtom.fx = fx;
        editedAtom.fy = fy;
        editedAtom.fz = fz;
    }
    else {
        editedAtom.x = x;
        editedAtom.y = y;
        editedAtom.z = z;
    }
};

// Cleanup
onUnmounted(() => {
    stopWatcher1();
});

const selectTitle = computed(() => (atomSelected.value && details.length > 0 ?
                              `Selected atom (index: ${details[0].index})` :
                              "Select an atom"));

const showConfirm = ref(false);
const confirmTitle = ref("");
const confirmText = ref("");
let action = "";
/**
 * Delete the selected atom
 */
const deleteAtom = (): void => {

    showConfirm.value = true;
    confirmText.value = "Do you want to remove the selected atom?";
    confirmTitle.value = "Confirm deletion";
    action = "Delete";
    modified.value = true;
};

/**
 * Edit the selected atom
 */
const editAtom = (): void => {
    showConfirm.value = true;
    confirmText.value = "Do you want to modify the selected atom?";
    confirmTitle.value = "Confirm editing";
    action = "Change";
    modified.value = true;
};

/**
 * Add a new atom
 */
const addAtom = (): void => {
    showConfirm.value = true;
    confirmText.value = "Do you want to add this atom?";
    confirmTitle.value = "Confirm add";
    action = "Create";
    modified.value = true;
};

/**
 * Reload the original structure
 */
const resetStructure = (): void => {
    showConfirm.value = true;
    confirmText.value = "Do you want to return to the initial state?";
    confirmTitle.value = "Confirm reset";
    action = "Reset";
    modified.value = false;
    renderer.clearOutput();
    details.length = 0;
    editedAtom.atomZ = 0;
    atomSelected.value = false;
    editedAtom.atomLabel = "";
    editedAtom.chain = "";
};

/**
 * Confirm the action
 */
const confirmAction = (): void => {

    const index = action === "Delete" || action === "Change" ? details[0]?.index : 0;

    askNode(id, "op", {
        action,
        index,
        atomZ: editedAtom.atomZ,
        label: editedAtom.atomLabel,
        chain: editedAtom.chain,
        useFractional: editedAtom.useFractional,
        x: editedAtom.x,
        y: editedAtom.y,
        z: editedAtom.z
    })
    .then((response) => {

        if(response.error) throw Error(response.error as string);

        if(action !== "Delete") return;
        details.length = 0;
        editedAtom.atomZ = 0;
        atomSelected.value = false;
        editedAtom.atomLabel = "";
        editedAtom.chain = "";
        editedAtom.x = 0;
        editedAtom.y = 0;
        editedAtom.z = 0;
        editedAtom.fx = 0;
        editedAtom.fy = 0;
        editedAtom.fz = 0;
    })
    .catch((error: Error) => {
        showSystemAlert(`Error from selecting atom in ${label}: ${error.message}`);
    })
    .finally(() => {
        showConfirm.value = false;
        renderer.clearOutput();
    });
};

</script>


<template>
<v-container class="container">
  <v-label class="separator-title first-title">{{ selectTitle }}</v-label>
  <v-container class="py-0 pl-1 pr-2">
    <v-table class="pa-1">
      <tr><td style="width: 35%">Atom type:</td>
          <td><v-select v-model="editedAtom.atomZ" :items="atomTypes"
                        item-title="title" item-value="value"/></td></tr>
      <tr><td>Label:</td>
          <td><v-text-field v-model.trim="editedAtom.atomLabel" spellcheck="false"
            :hide-details="true" density="compact"/></td></tr>
      <tr><td>Chain:</td>
          <td><v-text-field v-model.trim="editedAtom.chain" spellcheck="false"
            :hide-details="true" density="compact"/></td></tr>
    </v-table>
    <v-switch v-model="editedAtom.useFractional" label="Use fractional coords" class="my-2"
              @update:model-value="changedUseFractional"/>
    <v-table v-if="editedAtom.useFractional" class="pa-1">
      <tr><td style="width: 35%">fa:</td>
          <td><v-number-input v-model="editedAtom.fx" :min="0" :max="1" :step="0.001"
                              :precision="3" hide-details/></td></tr>
      <tr><td>fb:</td>
          <td><v-number-input v-model="editedAtom.fy" :min="0" :max="1" :step="0.001"
                              :precision="3" hide-details/></td></tr>
      <tr><td>fc:</td>
          <td><v-number-input v-model="editedAtom.fz" :min="0" :max="1" :step="0.001"
                              :precision="3" hide-details/></td></tr>
    </v-table>
    <v-table v-else class="pa-1">
      <tr><td style="width: 35%">x:</td>
          <td><v-number-input v-model="editedAtom.x" :min="-100" :max="100" :step="0.001"
                              :precision="3" hide-details/></td></tr>
      <tr><td>y:</td>
          <td><v-number-input v-model="editedAtom.y" :min="-100" :max="100" :step="0.001"
                              :precision="3" hide-details/></td></tr>
      <tr><td>z:</td>
          <td><v-number-input v-model="editedAtom.z" :min="-100" :max="100" :step="0.001"
                              :precision="3" hide-details/></td></tr>
    </v-table>
    <v-row class="mt-4 w-100 mb-4">
      <v-col><v-btn :disabled="!atomSelected"
                    class="w-100" @click="deleteAtom">Delete</v-btn></v-col>
      <v-col><v-btn :disabled="!atomSelected"
                    class="w-100" @click="editAtom">Change</v-btn></v-col>
      <v-col><v-btn :disabled="atomSelected"
                    class="w-100" @click="addAtom">Add</v-btn></v-col>
    </v-row>
  </v-container>
  <block-button :disabled="!modified" class="mb-2" label="Reset structure" @click="resetStructure"/>

  <v-dialog v-model="showConfirm">
    <v-card :title="confirmTitle" :text="confirmText"
            class="mx-auto no-select focus-visible-buttons" elevation="16" max-width="500">
      <v-card-actions>
        <v-btn v-focus @click="showConfirm=false">Dismiss</v-btn>
        <v-btn @click="confirmAction">{{ confirmTitle }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</v-container>
</template>
