<script setup lang="ts">
/**
 * @component
 * Debounced slider.
 * In the slot the value not yet debounced is made available.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */

import {ref, watch} from "vue";
import {mdiMinus, mdiPlus} from "@mdi/js";

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

    /** Slider disable */
    disabled?: boolean;

}>(), {
    min: 0,
    max: 10,
    step: 1,
    timeout: 500,
    disabled: false
});

/** Returning the debounced slider value */
const value = defineModel<number>();

const valueToDebounce = ref(value.value ?? props.min);
watch(value, () => {valueToDebounce.value = value.value ?? props.min;});

let debouncingTimeoutId: NodeJS.Timeout;
watch(valueToDebounce, () => {

    clearTimeout(debouncingTimeoutId);

    debouncingTimeoutId = setTimeout(() => {
        value.value = valueToDebounce.value;
    }, props.timeout);
});

/**
 * Decrement the value
 */
const decrement = (event: MouseEvent): void => {

    let delta = props.step;
    if(event.ctrlKey) delta *= event.shiftKey ? 100 : 10;
    else if(event.shiftKey) delta *= 100;
    let vv = valueToDebounce.value;
    vv -= delta;
    if(vv < props.min) vv = props.min;
    valueToDebounce.value = vv;
};

/**
 * Increment the value
 */
const increment = (event: MouseEvent): void => {

    let delta = props.step;
    if(event.ctrlKey) delta *= event.shiftKey ? 100 : 10;
    else if(event.shiftKey) delta *= 100;
    let vv = valueToDebounce.value;
    vv += delta;
    if(vv > props.max) vv = props.max;
    valueToDebounce.value = vv;
};

</script>


<template>
<v-container class="pa-0 ma-0 pr-2">
  <!-- @slot Here add the slider label (the not yet debounced value is available as {value}) -->
  <slot :value="valueToDebounce" />
  <v-slider v-model="valueToDebounce" :min :max :step :disabled hide-details class="ml-n2">
    <template #prepend>
      <v-btn :icon="mdiMinus" size="small" variant="text" @click="decrement" />
    </template>
    <template #append>
      <v-btn :icon="mdiPlus" size="small" variant="text" @click="increment" />
    </template>
  </v-slider>
</v-container>
</template>
