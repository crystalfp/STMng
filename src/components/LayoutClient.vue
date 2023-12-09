<script setup lang="ts">

import {ref} from "vue";
// import {onMounted, ref} from "vue";
// import {setTitle} from "@/services/RoutesClient";

import Viewer3D from "@/components/Viewer3D.vue";
import Viewer3DCtrl from "@/components/Viewer3DCtrl.vue";

const normalScreen = ref(true);
const toggleExpandedScreen = (): void => {
    normalScreen.value = !normalScreen.value;
};

// onMounted(() => {
//     setTitle("See the Molecole New Generation");
// });


// import {useTheme} from "vuetify";

// const theme = useTheme();
// theme.global.name.value = "dark";

// function toggleTheme () {
//   theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'
// }

</script>

<template>
<div class="layout-top">
  <div v-if="normalScreen" class="layout-west">
    <viewer3-d-ctrl />
  </div>
  <div class="layout-gutter" @click="toggleExpandedScreen" />
  <viewer3-d :expanded="!normalScreen" />
</div>
</template>


<style scoped lang="scss">

@use "@/styles/colors";

.layout-top {
  height: calc(100vh - 30px);
  display: flex;
  flex-direction: row;
  margin: 0;
  overflow: hidden;
  width: 99.9vw;
  // width: 100vw;
}

.layout-west {
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin: 0;
  width: 500px;
}

.layout-gutter {
  width: 6px;
  background-color: colors.$border;
  cursor: pointer;
}
</style>
