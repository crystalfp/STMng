<script setup lang="ts">

import {ref} from "vue";
import log from "electron-log";

// import {onMounted, ref} from "vue";
import {setTitle, isLoaded, handleFullscreen} from "@/services/RoutesClient";

import Viewer3D from "@/components/Viewer3D.vue";
import ControlsContainer from "@/components/ControlsContainer.vue";
import {loadElements} from "@/services/LoadElements";

const normalScreen = ref(true);
const toggleExpandedScreen = (): void => {
    normalScreen.value = !normalScreen.value;
};


// > React to fullscreen requests
window.addEventListener("DOMContentLoaded", () => {
    let count = 0;
    const timer = setInterval(() => {
        ++count;
        if(count > 50) {
          clearInterval(timer);
          log.error("Waiting too long for IPC to setup");
        }
        if(isLoaded()) {
            handleFullscreen((isFullScreen: boolean) => {
                const root = document.documentElement;
                root.style.setProperty("--usable-height", isFullScreen ? "100vh" : "calc(100vh - 30px)");
                root.style.setProperty("--container-height", isFullScreen ? "100vh" : "calc(100% - 74px)");
            });
            setTitle("See the Molecole New Generation");
            clearInterval(timer);
        }
    }, 20);
});

loadElements();
</script>

<template>
<div class="layout-top">
  <div v-if="normalScreen" class="layout-west">
    <controls-container />
  </div>
  <div class="layout-gutter" @click="toggleExpandedScreen" />
  <viewer3-d :expanded="!normalScreen" />
</div>
</template>


<style scoped lang="scss">

@use "@/styles/colors";

.layout-top {
  height: var(--usable-height);
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
