<script setup lang="ts">
/**
 * @component
 * Slider with increment/decrement buttons and debouncing
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {mdiMinus, mdiPlus} from "@mdi/js";
import {watch} from "vue";

// > Properties
const props = withDefaults(defineProps<{

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
}>(), {
    min: 0,
    max: 10,
    step: 1,
    label: "",
    labelWidth: "7rem",
    timeout: 500,
});

/** Returning the slider value */
const value = defineModel<number>();

/** Returning the not yet debounced value for display slider position */
const valueToDebounce = defineModel<number>("raw");
valueToDebounce.value = value.value ?? props.min;
watch(value, () => valueToDebounce.value = value.value ?? props.min);

/**
 * Decrement the value
 */
const decrement = (): void => {

    let vv = valueToDebounce.value ?? props.min;
    vv -= props.step;
    if(vv < props.min) vv = props.min;
    valueToDebounce.value = vv;
};

/**
 * Increment the value
 */
const increment = (): void => {

    let vv = valueToDebounce.value ?? props.min;
    vv += props.step;
    if(vv > props.max) vv = props.max;
    valueToDebounce.value = vv;
};

// Debounce the value
let debouncingTimeoutId: NodeJS.Timeout;
watch(valueToDebounce, () => {

    clearTimeout(debouncingTimeoutId);

    debouncingTimeoutId = setTimeout(() => {
        value.value = valueToDebounce.value;
    }, props.timeout);
});
</script>


<template>
<v-slider v-model="valueToDebounce" :min="min" :max="max" :step="step" :label="label"
          hide-details class="slider-with-stepper">
  <template #prepend>
    <v-btn :icon="mdiMinus" size="small" variant="text" class="ml-n2" @click="decrement" />
  </template>
  <template #append>
    <v-btn :icon="mdiPlus" size="small" variant="text" class="mr-n2" @click="increment" />
  </template>
</v-slider>
</template>


<style>
.slider-with-stepper .v-slider__label {
  /* stylelint-disable value-keyword-case */
  width: v-bind(labelWidth);
  user-select: none;
}
</style>
