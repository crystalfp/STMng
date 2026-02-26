<script setup lang="ts">
/**
 * @component
 * Debounced range slider.
 * In the slot the value not yet debounced is made available.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import {onUnmounted, ref, watch} from "vue";

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
const value = defineModel<number[]>();

const limitsToDebounce = ref<number[]>(value.value ?? [props.min, props.max]);
const stopWatcher1 = watch(value, () => {

    if(value.value) {
        limitsToDebounce.value[0] = value.value[0];
        limitsToDebounce.value[1] = value.value[1];
    }
    else {
        limitsToDebounce.value[0] = props.min;
        limitsToDebounce.value[1] = props.max;
    }
});

let debouncingTimeoutId: NodeJS.Timeout;
const stopWatcher2 = watch(limitsToDebounce, () => {

    clearTimeout(debouncingTimeoutId);

    debouncingTimeoutId = setTimeout(() => {
        value.value![0] = limitsToDebounce.value[0];
        value.value![1] = limitsToDebounce.value[1];
    }, props.timeout);
});

// Cleanup
onUnmounted(() => {
    stopWatcher1();
    stopWatcher2();
});

</script>


<template>
<v-container class="pa-0">
  <!-- @slot Here add the slider label (the not yet debounced value is available as {value}) -->
  <slot :values="limitsToDebounce" />
  <v-range-slider v-model="limitsToDebounce" strict
                  :step :min :max
                  class="ml-0 mt-1 pr-2" />
</v-container>
</template>
