<script setup lang="ts">
/**
 * @component
 * Show a button to input a color.
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {ref} from "vue";

// > Properties
const {transparency, label} = defineProps<{

    /** If true, select also transparency (if not present it is false) */
    transparency?: boolean;

    /** Label on the button */
    label: string;
}>();

const colorPickerShow = ref(false);
const color = defineModel<string>();

</script>


<template>
  <v-row>
    <v-col cols="12" class="pb-0 pr-2">
      <v-btn class="w-100"
             variant="outlined"
             prepend-icon="mdi-palette"
             @click="colorPickerShow = !colorPickerShow">
        <template #prepend>
          <v-icon size="x-large" :color></v-icon>
        </template>
        {{ label }}
      </v-btn>
    </v-col>
    <v-col class="pb-0">
      <v-color-picker v-if="colorPickerShow" v-model="color"
                :modes="transparency ? ['rgba', 'hsla', 'hexa'] : ['rgb', 'hsl', 'hex']"
                elevation="0" class="mb-4 mt-2" />
    </v-col>
  </v-row>
</template>
