<script setup lang="ts">

// import {ref} from "vue";
import {useConfigStore} from "@/stores/configStore";

// > Access the store
const configStore = useConfigStore();

</script>


<template>
<v-container class="container">
  <v-btn block class="mt-3" @click="configStore.control.snapshot = true">Capture snapshot</v-btn>
</v-container>
</template>
