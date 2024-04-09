<script setup lang="ts">
/**
 * @component
 * Align left margin of contained sliders.
 */


// > Properties
const {labelWidth = "2rem"} = defineProps<{

    /** Width for all the labels */
    labelWidth?: string;
}>();

</script>


<template>
<v-container class="pl-1">
  <slot />
</v-container>
</template>


<style>

/* stylelint-disable selector-class-pattern */
.v-slider__label {
  width: v-bind(labelWidth);
}

</style>
