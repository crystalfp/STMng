<script setup lang="ts">
/**
 * @component
 * Button with dead time after one activation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-11-30
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

 // > Properties & events
const props = withDefaults(defineProps<{

    /** Label for the button */
    label?: string;

    /** Timeout for debouncing (in milliseconds) */
    timeout?: number;

    /** Button disable */
    disabled?: boolean;

  }>(), {

    label: "Push me!",
    timeout: 500,
    disabled: false
});

const emit = defineEmits<{
    /** The button has been pressed */
    click: [];
}>();

/** Button is in the dead-time period */
let waiting = false;

/**
 * Button activated
 */
const click = (): void => {

    if(waiting) return;
    setTimeout(() => {waiting = false;}, props.timeout);
    waiting = true;
    emit("click");
};

</script>


<template>
<v-container class="pl-0 pt-0 pr-2">
  <v-btn block :disabled @click="click">{{ label }}</v-btn>
</v-container>
</template>
