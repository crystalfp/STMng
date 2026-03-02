<script setup lang="ts">
/**
 * @component
 * Legend component for viewers
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-06
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
import {onUnmounted, reactive, ref, watch} from "vue";
import {Lut} from "three/addons/math/Lut.js";

// > Properties
const {title, bottom=40, right=10, width=140, height=215, valuesContinue} = defineProps<{

    /** Legend title */
    title?: string;
    /** Positioning */
    bottom?: number;
    /** Positioning */
    right?: number;
    /** Width */
    width?: number;
    /** Legend height */
    height?: number;
    /** Values for a discrete legend */
    valuesDiscrete?: {color: string; label: string}[];
    /** Values for a continuous legend */
    valuesContinue?: {min: string; max: string; footer?: string; colormap: string};
}>();

const style = reactive({
    bottom: `${bottom}px`,
    right: `${right}px`,
    width: `${width}px`,
    height: `${height}px`
});

let colorScale;
const haveFooter = ref(false);
if(valuesContinue) {

    const stopWatch = watch(() => valuesContinue, () => {
        // Create the color scale for the legend
        const lut = new Lut(valuesContinue.colormap, 128);
        colorScale = lut.createCanvas().toDataURL();
        haveFooter.value = !!valuesContinue.footer;

    }, {deep: true, immediate: true});
    onUnmounted(() => stopWatch());
}
const haveHeader = ref(!!title);

</script>


<template>
<div class="legend" :style>
  <div v-if="valuesDiscrete !== undefined" class="px-1">
    <div v-if="haveHeader" class="w-100 d-flex justify-center mt-2 mb-1">{{ title }}</div>
    <div v-for="n of valuesDiscrete" :key="n.color">
      <span :style="{backgroundColor: n.color}" class="ml-2 mr-3">&emsp;</span>{{ n.label }}
    </div>
  </div>
    <div v-else-if="valuesContinue !== undefined" class="legend-grid">
      <div v-show="haveHeader" class="side-tt">{{ title }}</div>
      <div class="side-ll"><img :src="colorScale" height="100%" width="30"></div>
      <div class="side-rt">{{ valuesContinue.max }}</div>
      <div class="side-rb">{{ valuesContinue.min }}</div>
      <div v-show="haveFooter" class="side-bb">{{ valuesContinue.footer }}</div>
    </div>
</div>
</template>


<style scoped>

.legend {
  position: absolute;
  z-index: 800;
  background-color: #7e7e7e46;
  overflow: hidden auto;
  padding: 0 !important;
  color: light-dark(#202020, #e6e6e6);
}

.legend-grid {
  display: grid;
  gap: 5px;
  grid-auto-flow: row;
  grid-template:
    "tt tt" 50px
    "ll rt" 1fr
    "ll rb" 25px
    "bb bb" 25px / 30px 1fr;
  height: 100%;
  padding: 5px 10px;
  overflow: hidden;
}
.side-tt {grid-area: tt; text-align: center; margin-bottom: 5px;}

.side-ll {grid-area: ll;}

.side-rt {grid-area: rt; text-align:right; vertical-align:top;}

.side-rb {grid-area: rb; text-align:right; vertical-align:bottom;}

.side-bb {grid-area: bb; text-align: center;}

</style>
