<script setup lang="ts">
/**
 * @component
 * Controls for the capture media node.
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
import {computed} from "vue";
import {useConfigStore} from "@/stores/configStore";
import {useControlStore} from "@/stores/controlStore";
import NodeAlert from "@/widgets/NodeAlert.vue";
import TitledSlot from "@/widgets/TitledSlot.vue";
import BlockButton from "@/widgets/BlockButton.vue";

// > Access the stores
const configStore = useConfigStore();
const controlStore = useControlStore();

// Show this module has been loaded
controlStore.hasCapture = true;

/** Simplify label */
const startStop = computed(() => (controlStore.movie ? "Stop recording" : "Start recording"));

</script>


<template>
<v-container class="container">
  <v-label class="separator-title first-title">Snapshot</v-label>

  <titled-slot title="Format:" inline class="mt-4 ml-1 mb-3">
    <v-btn-toggle v-model="configStore.camera.snapshotFormat" mandatory>
      <v-btn value="png">PNG</v-btn>
      <v-btn value="jpeg">JPEG</v-btn>
      <v-btn value="pdf">PDF</v-btn>
    </v-btn-toggle>
  </titled-slot>

  <v-switch v-model="configStore.camera.snapshotTransparent"
            :disabled="configStore.camera.snapshotFormat!=='png'"
            label="Transparent background" class="mt-4 ml-2" />
  <block-button class="mt-4 mb-n4" label="Capture snapshot" @click="controlStore.snapshot = true"/>
  <node-alert node="captureSnapshot" class="mt-6 mb-n4" />

  <v-label class="mt-10 separator-title">Movie</v-label>
  <block-button class="mt-3 mb-n4" :color="controlStore.movie ? 'red' : 'primary'"
                :label="startStop" @click="controlStore.movie = !controlStore.movie"/>
  <node-alert node="captureMovie" :timeout="0" class="mt-4 mb-0" />

  <v-label class="mt-8 separator-title">STL</v-label>

  <titled-slot title="Format:" inline class="mt-4 ml-1 mb-6">
    <v-btn-toggle v-model="configStore.camera.stlFormat" mandatory>
      <v-btn value="ascii">ASCII</v-btn>
      <v-btn value="binary">Binary</v-btn>
    </v-btn-toggle>
  </titled-slot>

  <block-button class="mt-3" label="Capture geometry" @click="controlStore.stl = true" />
  <node-alert node="captureSTL" class="mt-2" />
</v-container>
</template>
