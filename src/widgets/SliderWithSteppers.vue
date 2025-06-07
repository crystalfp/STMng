<script setup lang="ts">
/**
 * @component
 * Slider with increment/decrement buttons and debouncing.
 *
 * @author Mario Valle "mvalle at ikmail.com"
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

    /** Slider disable */
    disabled?: boolean;

  }>(), {
    min: 0,
    max: 10,
    step: 1,
    label: "",
    labelWidth: "7rem",
    timeout: 500,
    disabled: false
});

/** Returning the slider value */
const value = defineModel<number>();

/** Returning the not yet debounced value for display slider position */
const valueToDebounce = defineModel<number>("raw");
valueToDebounce.value = value.value ?? props.min;
watch(value, () => {valueToDebounce.value = value.value ?? props.min;});

/**
 * Decrement the value
 */
const decrement = (event: MouseEvent): void => {

    let delta = props.step;
    if(event.ctrlKey) delta *= event.shiftKey ? 100 : 10;
    else if(event.shiftKey) delta *= 100;
    let vv = valueToDebounce.value ?? props.min;
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
    let vv = valueToDebounce.value ?? props.min;
    vv += delta;
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
<v-slider v-model="valueToDebounce" :min :max :step :label
          :disabled hide-details class="slider-with-stepper">
  <template #prepend>
    <v-btn :icon="mdiMinus" size="small" variant="text" @click="decrement" />
  </template>
  <template #append>
    <v-btn :icon="mdiPlus" size="small" variant="text" @click="increment" />
  </template>
</v-slider>
</template>


<style>
/* Style cannot be scoped */

.slider-with-stepper .v-slider__label {
  /* stylelint-disable value-keyword-case */
  width: v-bind(labelWidth);
  user-select: none;
}
</style>
