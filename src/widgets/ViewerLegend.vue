<script setup lang="ts">
/**
 * @component
 * Legend component for viewers
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-06
 */
import {reactive} from "vue";

// > Properties
const {bottom=40, right=10, width=140, height=215} = defineProps<{

    /** Legend title */
    title: string;
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
    valuesContinue?: {min: string; max: string; footer: string; colormap: string};
}>();

const style = reactive({
    bottom: `${bottom}px`,
    right: `${right}px`,
    width: `${width}px`,
    height: `${height}px`
});

</script>


<template>
<div class="legend" :style>
  <p>{{ title }}</p>
  <template v-if="valuesDiscrete !== undefined">
    <div v-for="n of valuesDiscrete" :key="n.color">
      <span :style="{backgroundColor: n.color}">&emsp;</span>{{ n.label }}
    </div>
  </template>
  <template v-else-if="valuesContinue !== undefined">
    TBD
  </template>
</div>
</template>


<style scoped>

.legend {
  position: absolute;
  z-index: 800;
  background-color: #7e7e7e46;
  overflow: hidden auto;
  padding-left: 7px;
  padding-top: 7px;
  color: black;
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
</style>
