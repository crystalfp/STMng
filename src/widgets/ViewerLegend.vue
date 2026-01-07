<script setup lang="ts">
/**
 * @component
 * Legend component for viewers
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-06
 */
import {reactive, ref, watch} from "vue";
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

    watch(() => valuesContinue, () => {
        // Create the color scale for the legend
        const lut = new Lut(valuesContinue.colormap, 128);
        colorScale = lut.createCanvas().toDataURL();
        haveFooter.value = !!valuesContinue.footer;

    }, {deep: true, immediate: true});
}
const haveHeader = ref(!!title);

</script>


<template>
<div class="legend" :style>
  <div v-if="valuesDiscrete !== undefined" style="padding: 5px 3px">
    <p v-if="haveHeader">{{ title }}</p>
    <div v-for="n of valuesDiscrete" :key="n.color">
      <span :style="{backgroundColor: n.color}">&emsp;</span>{{ n.label }}
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

p {
  width: 100%;
  text-align: center;
  margin-bottom: 5px;
}

span {
  margin-left: 7px;
  margin-right: 10px;
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
