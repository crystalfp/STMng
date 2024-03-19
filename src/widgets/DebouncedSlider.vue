<script setup lang="ts">
/**
 * @component
 * Debounced slider. In the slot the value not yet debounced is made available
 */

import {ref, watch} from "vue";

// > Properties
const props = withDefaults(defineProps<{

    /** Minimum value for the slider */
    min?: number;

    /** Maximum value for the slider */
    max?: number;

    /** Step for the slider */
    step?: number;

    /** Timeout for debouncing (in milliseconds) */
    timeout?: number;

}>(), {
    min: 0,
    max: 10,
    step: 1,
    timeout: 500
});

/** Returning the debounced slider value */
const value = defineModel<number>();

const valueToDebounce = ref(value.value ?? props.min);
let debouncingTimeoutId: NodeJS.Timeout;
watch(valueToDebounce, () => {

    clearTimeout(debouncingTimeoutId);

    debouncingTimeoutId = setTimeout(() => {
        value.value = valueToDebounce.value;
    }, props.timeout);
});

</script>


<template>
<!-- @slot Here add the slider label (the not yet debounced value is available as {value}) -->
<slot :value="valueToDebounce" />
<v-slider v-model="valueToDebounce" :min="min" :max="max" :step="step" />
</template>
