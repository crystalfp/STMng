<script setup lang="ts">

import {ref} from "vue";

const normalScreen = ref(true);
const toggleExpandedScreen = (): void => {
    normalScreen.value = !normalScreen.value;
};

</script>


<template>
<div class="layout-top">
  <div v-if="normalScreen" class="layout-west">
    Here!
  </div>
  <div class="layout-gutter" @click="toggleExpandedScreen" />
  <div class="layout-center">
    Viewer!
  </div>
</div>
</template>


<style scoped lang="scss">

@use "@/styles/colors";

.layout-top {
  height: calc(100vh - 32px);
  display: flex;
  flex-direction: row;
  margin: 0;
  overflow: hidden;
  width: 100vw;
}

.layout-center {
  box-sizing: border-box;
  overflow: hidden;
  flex-grow: 1;
  width: calc(100vw - 649px); // Full screen minus columns width minus gutter width
}

.layout-west {
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin: 0;
  width: 310px;
}

.layout-gutter {
  width: 4px;
  background-color: colors.$border;
  cursor: pointer;
}
</style>
