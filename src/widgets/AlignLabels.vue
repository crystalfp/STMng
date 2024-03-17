<script setup lang="ts">
/**
 * @component
 * Align left margin of contained sliders.
 */

import {ref} from "vue";

// > Properties
const props = withDefaults(defineProps<{

    /** Width for all the labels */
    labelWidth?: string;
}>(), {
    labelWidth: "2rem"
});

const width = ref(props.labelWidth);
</script>


<template>
<v-container class="pl-1">
  <slot />
</v-container>
</template>


<style>

/* stylelint-disable selector-class-pattern */
.v-slider__label {
  width: v-bind(width);
}

</style>
