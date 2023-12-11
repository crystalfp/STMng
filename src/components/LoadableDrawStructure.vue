<script setup lang="ts">

import {ref} from "vue";

const drawKind = ref("ball-and-stick");

</script>


<template>
<v-container class="container">
  <v-radio-group v-model="drawKind" inline>
    <v-radio label="B&S" value="ball-and-stick" /><v-spacer />
    <v-radio label="VdW" value="van-der-walls" /><v-spacer />
    <v-radio label="Licorice" value="licorice" />
  </v-radio-group>
  <v-label :text="drawKind" />
</v-container>
</template>
