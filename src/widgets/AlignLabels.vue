<script setup lang="ts">
/**
 * @component
 * Align left margin of contained sliders.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

// > Properties
const {labelWidth = "2rem"} = defineProps<{

    /** Width for all the labels (CSS units) */
    labelWidth?: string;
}>();

</script>


<template>
<v-container class="pl-1">
  <!-- @slot Here add the sliders whose labels should have the same width -->
  <slot />
</v-container>
</template>


<style>
/* Style cannot be scoped */

.v-slider__label {
  /* stylelint-disable value-keyword-case */
  width: v-bind(labelWidth);
}

</style>
