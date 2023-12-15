<script setup lang="ts">

import {ref, watchEffect} from "vue";

const readFile = ref<File[] | undefined>();

watchEffect(() => {
    console.log("Struct", readFile.value); // TBD
});

</script>


<template>
<v-container class="container">
  <v-file-input v-model="readFile" label="File input" variant="solo-filled"
  accept=".doc,.docx,.xml,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
</v-container>
</template>


<style scoped lang="scss">

@use "@/styles/colors";
@use "@/styles/fonts";

</style>
