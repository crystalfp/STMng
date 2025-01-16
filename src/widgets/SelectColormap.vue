<script setup lang="ts">
/**
 * @component
 * Selector for the colormaps provided by Lut
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-01-16
 */

/** Available colormaps */
const colormaps = ["rainbow", "cooltowarm", "blackbody", "grayscale"];
const colormapName = defineModel<string>();

</script>


<template>
<v-select v-model="colormapName" label="Colormap" :items="colormaps" />
</template>
