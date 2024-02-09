<script setup lang="ts">
/**
 * @component
 * Main entry point of the application. It defines the general layout of the screen.
 */

import {ref, shallowRef, defineAsyncComponent} from "vue";
import log from "electron-log";
import Mousetrap from "mousetrap";
import {isLoaded, handleFullscreen, setProjectPathInTitle,
        receiveMenuSelection} from "@/services/RoutesClient";
import {sb} from "@/services/Switchboard";

import Viewer3D from "@/components/Viewer3D.vue";
import ControlsContainer from "@/components/ControlsContainer.vue";

/** Toggle expanded viewer window */
const normalScreen = ref(true);
const toggleExpandedScreen = (): void => {
    normalScreen.value = !normalScreen.value;
};

// > React to fullscreen requests and set title
window.addEventListener("DOMContentLoaded", () => {
    let count = 0;
    const timer = setInterval(() => {
        ++count;
        if(count > 50) {
          clearInterval(timer);
          log.error("Waiting too long for IPC to setup");
        }
        if(isLoaded()) {
            clearInterval(timer);
            handleFullscreen((isFullScreen: boolean) => {
                const root = document.documentElement;
                root.style.setProperty("--usable-height",    isFullScreen ? "100vh" : "calc(100vh - 30px)");
                root.style.setProperty("--container-height", isFullScreen ? "calc(100vh - 44px)" : "calc(100vh - 74px)");
            });
            setProjectPathInTitle("See the Molecole new generation");
            sb.setup();
        }
    }, 20);
});

// > Setup global keyboard shortcuts
Mousetrap
    .bind("f", toggleExpandedScreen); // "f" toggle expanded screen


// > The component to load in response to admin and load menus selections
const loadedPanel = shallowRef<unknown>();
receiveMenuSelection((menuEntry: string) => {

    if(menuEntry === "show-versions") {
        loadedPanel.value = defineAsyncComponent(() => import("@/components/About.vue"));
    }
    else {
        log.error(`Menu entry "${menuEntry}" is not implemented`);
    }
});

</script>

<template>
<div class="layout-top">
  <div v-if="normalScreen" class="layout-west">
    <controls-container />
  </div>
  <div class="layout-gutter" @click="toggleExpandedScreen" />
  <viewer3-d :expanded="!normalScreen" />
</div>
<component :is="loadedPanel" @close-panel="loadedPanel = undefined" />
</template>


<style scoped lang="scss">

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
  background-color: rgb(var(--v-theme-surface-light));
  cursor: pointer;
}
</style>
