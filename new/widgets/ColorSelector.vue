<script setup lang="ts">
/**
 * @component
 * Show a button to change a color
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {ref} from "vue";
import {mdiRectangle} from "@mdi/js";

// > Properties
const {transparency = false, label} = defineProps<{

    /** If true, select also transparency */
    transparency?: boolean;

    /** Label on the button */
    label: string;
}>();

const colorPickerShow = ref(false);
const lineColor = defineModel<string>();
</script>


<template>
<v-btn class="mb-6 ml-2 px-4 w-50" @click="colorPickerShow = !colorPickerShow">
  <template #append>
    <v-icon :icon="mdiRectangle" :color="lineColor" size="x-large" />
  </template>
  {{ label }}
</v-btn><br>
<v-color-picker v-if="colorPickerShow" v-model="lineColor"
                :modes="transparency ? ['rgba', 'hsla', 'hexa'] : ['rgb', 'hsl', 'hex']"
                elevation="0" class="mb-4 ml-2" />
</template>
