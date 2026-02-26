<script setup lang="ts">
/**
 * @component
 * Align left margin of contained sliders.
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
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */

// > Properties
const {labelWidth = "2rem"} = defineProps<{

    /** Width for all the labels (CSS units) */
    labelWidth?: string;
}>();

</script>


<template>
<v-container class="pl-1">
  <!-- @slot Here add the sliders whose labels should have the same width -->
  <slot />
</v-container>
</template>


<style scoped>

:deep(.v-slider__label) {
  /* stylelint-disable value-keyword-case */
  width: v-bind(labelWidth);
}

</style>
