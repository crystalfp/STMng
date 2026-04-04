<script setup lang="ts">
/**
 * @component
 * Control to reset the camera and change view direction
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-12-09
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
import {ref, watch, computed, onUnmounted} from "vue";
import {useControlStore} from "@/stores/controlStore";

const controlStore = useControlStore();

const showPanel = ref(0);
const axisSign = ref("+");
const lookAxis = ref("z");
const stopWatcher = watch(lookAxis, (after) => {

    switch(after) {
        case "r":
            controlStore.reset = true;
            controlStore.viewDirection = "";
            break;
        case "0":
            showPanel.value = 1;
            break;
        case "1":
            showPanel.value = hasCell.value ? 2 : 0;
            break;
        case "2":
            showPanel.value = 0;
            break;
        case "s":
            axisSign.value = axisSign.value === "+" ? "-" : "+";
            break;
        case "":
            return;
        default:
            controlStore.viewDirection = axisSign.value + after;
            break;
    }
    lookAxis.value = "";
});

// Cleanup
onUnmounted(() => stopWatcher());

const hasCell = computed(() => controlStore.basis.some((b) => b !== 0));

</script>


<template>
<v-container class="w-100 d-flex justify-center pt-2">
  <v-btn-toggle v-if="showPanel===0" v-model="lookAxis" mandatory variant="text" :divided="false"
                rounded="0" class="muted" density="compact">
    <v-btn value="0" icon="mdi-alpha-x-box-outline" size="x-large"/>
    <v-btn value="r" class="pl-16">Reset camera</v-btn>
  </v-btn-toggle>
  <v-btn-toggle v-if="showPanel===1" v-model="lookAxis" mandatory variant="text" :divided="false"
                rounded="0" class="muted" density="compact">
    <v-btn value="1" :icon="hasCell ? 'mdi-alpha-a-box-outline' : 'mdi-alpha-h-box-outline'" size="x-large"/>
    <v-btn value="x">X</v-btn>
    <v-btn value="y">Y</v-btn>
    <v-btn value="z">Z</v-btn>
    <v-btn value="s" :icon="axisSign ==='+' ? 'mdi-plus' : 'mdi-minus'"/>
  </v-btn-toggle>
  <v-btn-toggle v-if="showPanel===2" v-model="lookAxis" mandatory variant="text" :divided="false"
                rounded="0" class="muted" density="compact">
    <v-btn value="2" icon="mdi-alpha-h-box-outline" size="x-large" />
    <v-btn value="a">a</v-btn>
    <v-btn value="b">b</v-btn>
    <v-btn value="c">c</v-btn>
    <v-btn value="s" :icon="axisSign ==='+' ? 'mdi-plus' : 'mdi-minus'"/>
  </v-btn-toggle>
</v-container>
</template>


<style scoped>
.muted {
  color: rgb(var(--v-theme-primary), var(--v-medium-emphasis-opacity)) !important
}
</style>
