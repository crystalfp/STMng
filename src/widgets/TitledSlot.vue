<script setup lang="ts">
/**
 * @component
 * Add a title to a slot that normally contains a button toggle.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-07-15
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
import {useSlots} from "vue";

// > Properties
const {title, inline} = defineProps<{

    /** Title for the slot */
    title: string;

    /** True if the label is on the same line as the slot (if not present it is false) */
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
  <v-col cols="12" class="pa-0 mb-n1">
    <v-label :text="title" class="no-select" />
  </v-col>
  <v-col>
    <!-- @slot Here add the btn toggle -->
    <slot />
  </v-col>
  <v-col v-if="slots.extra" cols="12">
    <!-- @slot Here add another (optional) component that should align with the rest -->
    <slot name="extra" />
  </v-col>
</v-row>
</template>
