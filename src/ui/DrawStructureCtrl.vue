<script setup lang="ts">

import {ref} from "vue";

const drawKind = ref("ball-and-stick");

</script>


<template>
<v-container class="container">
  <v-radio-group v-model="drawKind" inline label="Structure rendering mode">
    <v-radio label="CPK" value="ball-and-stick" />
    <v-spacer />
    <v-radio label="VdW" value="van-der-walls" />
    <v-spacer />
    <v-radio label="Licorice" value="licorice" />
    <v-spacer />
    <v-radio label="Lines" value="lines" />
  </v-radio-group>
  <v-label :text="drawKind" />
</v-container>
</template>
