<script setup lang="ts">
/**
 * @component
 * Slider with increment/decrement buttons and debouncing
 */
import {mdiMinus, mdiPlus} from "@mdi/js";
import {watch} from "vue";

// > Properties
const {
    min = 0,
    max = 10,
    step = 1,
    label = "",
    labelWidth = "0",
    timeout = 500,
} = defineProps<{

    /** Minimum value for the slider */
    min?: number;

    /** Maximum value for the slider */
    max?: number;

    /** Step for the slider */
    step?: number;

    /** Label for the slider */
    label?: string;

    /** Space for the label (CSS units) */
    labelWidth?: string;

    /** Timeout for debouncing (in milliseconds) */
    timeout?: number;
}>();

/** Returning the slider value */
const value = defineModel<number>();

/** Returning the not yet debounced value for display slider position */
const valueToDebounce = defineModel<number>("raw");
valueToDebounce.value = value.value ?? min;

/**
 * Decrement the value
 */
const decrement = (): void => {

    let vv = valueToDebounce.value ?? min;
    vv -= step;
    if(vv < min) vv = min;
    valueToDebounce.value = vv;
};

/**
 * Increment the value
 */
const increment = (): void => {
    let vv = valueToDebounce.value ?? min;
    vv += step;
    if(vv > max) vv = max;
    valueToDebounce.value = vv;
};

// Debounce the value
let debouncingTimeoutId: NodeJS.Timeout;
watch(valueToDebounce, () => {

    clearTimeout(debouncingTimeoutId);

    debouncingTimeoutId = setTimeout(() => {
        value.value = valueToDebounce.value;
    }, timeout);
});
</script>


<template>
<v-slider v-model="valueToDebounce" :min="min" :max="max" :step="step" :label="label"
          hide-details class="slider-with-stepper">
  <template v-slot:prepend>
    <v-btn :icon="mdiMinus" size="small" variant="text" class="ml-n2" @click="decrement" />
  </template>
  <template v-slot:append>
    <v-btn :icon="mdiPlus" size="small" variant="text" class="mr-n2" @click="increment" />
  </template>
</v-slider>
</template>


<style>
/* stylelint-disable selector-class-pattern */
.slider-with-stepper .v-slider__label {
  width: v-bind(labelWidth);
}
</style>
