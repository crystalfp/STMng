<script setup lang="ts">
/**
 * @component
 * Show a button to input a color.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {ref} from "vue";
import {mdiPalette} from "@mdi/js";

// > Properties
const {transparency = false, label} = defineProps<{

    /** If true, select also transparency */
    transparency?: boolean;

    /** Label on the button */
    label: string;
}>();

const colorPickerShow = ref(false);
const color = defineModel<string>();

</script>


<template>
  <v-row>
    <v-col cols="12" class="pb-0">
      <v-btn class="w-100"
             variant="outlined"
             :prepend-icon="mdiPalette"
             @click="colorPickerShow = !colorPickerShow">
        <template v-slot:prepend>
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
