<script setup lang="ts">
/**
 * @component
 * Show a button to change a color.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {ref} from "vue";
import {mdiRectangle} from "@mdi/js";

// > Properties
const {transparency = false, label, block=false} = defineProps<{

    /** If true, select also transparency */
    transparency?: boolean;

    /** Label on the button */
    label: string;

    /** To stretch the button across the container */
    block?: boolean;
}>();

const colorPickerShow = ref(false);
const lineColor = defineModel<string>();

</script>


<template>
  <v-row>
    <v-col cols="12" class="pb-0">
      <v-btn class="w-50" :class="{'w-100': block}"
             @click="colorPickerShow = !colorPickerShow">
        <template #append>
          <v-icon :icon="mdiRectangle" :color="lineColor" size="x-large" />
        </template>
        {{ label }}
      </v-btn>
    </v-col>
    <v-col class="pb-0">
      <v-color-picker v-if="colorPickerShow" v-model="lineColor"
                :modes="transparency ? ['rgba', 'hsla', 'hexa'] : ['rgb', 'hsl', 'hex']"
                elevation="0" class="mb-4 mt-2" />
    </v-col>
  </v-row>
</template>
