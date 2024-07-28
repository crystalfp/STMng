<script setup lang="ts">
/**
 * @component
 * Debounced range slider. In the slot the value not yet debounced is made available
 */

import {ref, watch} from "vue";

// > Properties
const {
    min = 0,
    max = 10,
    step = 1,
    timeout = 500
} = defineProps<{

    /** Minimum value for the slider */
    min?: number;

    /** Maximum value for the slider */
    max?: number;

    /** Step for the slider */
    step?: number;

    /** Timeout for debouncing (in milliseconds) */
    timeout?: number;

}>();

/** Returning the debounced slider value */
const value = defineModel<number[]>();

const limitsToDebounce = ref<number[]>(value.value ?? [min, max]);
watch(value, () => {

    if(value.value) {
        limitsToDebounce.value[0] = value.value[0];
        limitsToDebounce.value[1] = value.value[1];
    }
    else {
        limitsToDebounce.value[0] = min;
        limitsToDebounce.value[1] = max;
    }
});

let debouncingTimeoutId: NodeJS.Timeout;
watch(limitsToDebounce, () => {

    clearTimeout(debouncingTimeoutId);

    debouncingTimeoutId = setTimeout(() => {
        value.value![0] = limitsToDebounce.value[0];
        value.value![1] = limitsToDebounce.value[1];
    }, timeout);
});

</script>


<template>
<!-- @slot Here add the slider label (the not yet debounced value is available as {value}) -->
<slot :values="limitsToDebounce" />
<v-range-slider v-model="limitsToDebounce" strict :step="step" :min="min" :max="max"
                color="primary" class="ml-4 mt-1 pr-2" />
</template>
