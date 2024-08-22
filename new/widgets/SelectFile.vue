<script setup lang="ts">
/**
 * @component
 * Widget to select a file. The selector is called in the main process
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-08-22
 */
import {mdiFileOutline} from "@mdi/js";

// > Properties and emits
defineProps<{

    /** Disable the widget */
    disabled: boolean;

    /** True if the file is loading */
    loading: boolean;

    /** Title for the display field */
    title: string;

    /** Label to be show (the file selected) */
    label: string;
}>();

const emit = defineEmits<{
    /** The indicator button has been pressed */
    "click": [];
}>();

</script>


<template>
<v-row :disabled="disabled" class="mt-2" @click="emit('click')">
  <v-icon :icon="mdiFileOutline" size="x-large" class="ml-4 mr-2 mt-1" style="opacity: 0.4" />
  <v-text-field :model-value="label" :disabled="disabled" :label="title" readonly
                class="mb-2 mr-2" hide-details="auto" :loading="loading" spellcheck="false" />
</v-row></template>
