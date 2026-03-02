<script setup lang="ts">
/**
 * @component
 * Button that span the whole width of the container but that can set margins
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-20
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */

 // > Properties & events
withDefaults(defineProps<{

    /** Label for the button */
    label: string;

    /** Button disable */
    disabled?: boolean;

    /** Show that the corresponding operation is running */
    loading?: boolean;

  }>(), {

    disabled: false,
    loading: false
});

const emit = defineEmits<{
    /** The button has been pressed */
    click: [];
}>();

</script>


<template>
<v-container class="pl-0 pt-0 pr-2">
  <v-btn block :disabled :loading @click="emit('click')">{{ label }}</v-btn>
</v-container>
</template>
