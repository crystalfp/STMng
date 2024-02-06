<script setup lang="ts">

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

.v-slider__label {
  width: v-bind(width);
}

</style>
