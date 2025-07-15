<script setup lang="ts">
/**
 * @component
 * Add a title to a slot that normally contains a button toggle.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-07-15
 */
import {useSlots} from "vue";

// > Properties
const {title, inline=false} = defineProps<{

    /** Title for the slot */
    title: string;

    inline?: boolean;
}>();

const slots = useSlots();

</script>


<template>
<v-row v-if="inline">
  <v-label class="mr-4 no-select" :text="title" />
  <!-- @slot Here add the btn toggle -->
  <slot />
</v-row>
<v-row v-else>
  <v-col cols="12" class="pa-0 mb-n2">
    <v-label :text="title" class="no-select" />
  </v-col>
  <v-col class="ml-n3">
    <!-- @slot Here add the btn toggle -->
    <slot />
  </v-col>
  <v-col v-if="slots.extra" cols="12" class="ml-n3">
    <!-- @slot Here add other component that should align with the rest -->
    <slot name="extra" />
  </v-col>
</v-row>
</template>
