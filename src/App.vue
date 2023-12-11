<script setup lang="ts">
/**
 * @component
 * Where the windows are anchored. It also load the global CSS styles
 */
import {RouterView} from "vue-router";
</script>

<template>
<router-view />
</template>

<style lang="scss">
@use "@/styles/colors";
@use "@/styles/fonts";
@use "@/styles/common";
@use "@/styles/popups";
@use "@/styles/vuetify"
</style>
