<script setup lang="ts">
/**
 * @component
 * Enable capture switches for the Structure reader module.
 * Each switch is enabled if the corresponding `has*` variable
 * is set in the controlStore.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-08-26
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
import {computed} from "vue";
import {useControlStore} from "@/stores/controlStore";

// Access the global control area
const controlStore = useControlStore();

const showSection = computed<boolean>(() => controlStore.hasCapture ||
                                            controlStore.hasTrajectory ||
                                            controlStore.hasFingerprints ||
                                            controlStore.hasWriter ||
                                            controlStore.hasVariableComposition ||
                                            controlStore.hasEnthalpyTransition
);

</script>


<template>
<v-container v-if="showSection" class="pa-0 mb-4 mt-n8">
  <v-divider thickness="2" class="mr-4 ml-n4 mb-2"/>
  <v-switch v-if="controlStore.hasCapture"
            v-model="controlStore.movie"
            label="Movie from steps" />
  <v-switch v-if="controlStore.hasTrajectory"
            v-model="controlStore.trajectoriesRecording"
            :disabled="!controlStore.trajectoriesHasSelector"
            label="Record trajectories" />
  <v-switch v-if="controlStore.hasFingerprints"
            v-model="controlStore.fingerprintsAccumulate"
            label="Accumulate for fingerprinting" />
  <v-switch v-if="controlStore.hasWriter"
            v-model="controlStore.writerAccumulate"
            label="Collect for structure writer" />
  <v-switch v-if="controlStore.hasVariableComposition"
            v-model="controlStore.variableCompositionAccumulate"
            label="Collect for variable composition" />
  <v-switch v-if="controlStore.hasEnthalpyTransition"
            v-model="controlStore.enthalpyTransitionAccumulate"
            label="Collect for enthalpy transition" />
  <v-divider thickness="2" class="mr-4 ml-n4 mb-2 mt-2"/>
</v-container>
</template>
