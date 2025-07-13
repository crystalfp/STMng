<script setup lang="ts">
/**
 * @component
 * Show a button to input a color.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {ref} from "vue";

// > Properties
const {transparency = false, label, block = false} = defineProps<{

    /** If true, select also transparency */
    transparency?: boolean;

    /** Label on the button */
    label: string;

    /** To stretch the button across the container */
    block?: boolean;
}>();

const colorPickerShow = ref(false);
const color = defineModel<string>();

</script>


<template>
  <v-row>
    <v-col cols="12" class="pb-0">
      <v-btn class="w-50" :class="{'w-100': block}"
             :color variant="flat"
             @click="colorPickerShow = !colorPickerShow">
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
