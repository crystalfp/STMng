<script setup lang="ts">
/**
 * @component
 * Selector for the colormaps provided by Lut
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-01-16
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

/** Available colormaps */
const colormaps = ["rainbow", "cooltowarm", "blackbody", "grayscale"];
const colormapName = defineModel<string>();

</script>


<template>
<v-select v-model="colormapName" label="Colormap" :items="colormaps" />
</template>
