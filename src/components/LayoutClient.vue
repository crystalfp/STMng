<script setup lang="ts">
/**
 * @component
 * Main entry point of the application. It defines the general layout of the screen.
 */

import {ref, shallowRef, defineAsyncComponent} from "vue";
import {isLoaded, handleFullscreen, setProjectPathInTitle, receiveRefreshMenu,
        receiveMenuSelection, receiveNotifications} from "@/services/RoutesClient";
import {sb} from "@/services/Switchboard";
import {showErrorNotification} from "@/services/ErrorNotification";
import {sm} from "@/services/SceneManager";

import Viewer3D from "@/components/Viewer3D.vue";
import ControlsContainer from "@/components/ControlsContainer.vue";

/** Normal/Expanded viewer window */
const normalScreen = ref(true);

// > React to fullscreen requests and set title
window.addEventListener("DOMContentLoaded", () => {
    let count = 0;
    const timer = setInterval(() => {
        ++count;
        if(count > 50) {
          clearInterval(timer);
          showErrorNotification("Waiting too long for IPC to setup");
        }
        if(isLoaded()) {
            clearInterval(timer);
            handleFullscreen((isFullScreen: boolean) => {
                const root = document.documentElement;
                root.style.setProperty("--usable-height",    isFullScreen ? "100vh" : "calc(100vh - 30px)");
                root.style.setProperty("--container-height", isFullScreen ? "calc(100vh - 74px)" :
                                                                            "calc(100vh - 104px)");
            });
            setProjectPathInTitle("See the Molecole new generation");
            sb.setup();
            receiveRefreshMenu();
        }
    }, 20);
});

// > The component to load in response to menus selections
const loadedPanel = shallowRef<unknown>();
receiveMenuSelection((menuEntry: string, payload: string) => {

    switch(menuEntry) {
        case "show-versions":
            loadedPanel.value = defineAsyncComponent(() => import("@/components/About.vue"));
            break;
        case "extend-viewer":
            normalScreen.value = payload === "no";
            break;
        case "show-scene":
            sm.dumpScene("Scene 3D");
            break;
        default:
            showErrorNotification(`Menu entry "${menuEntry}" is not implemented`);
            break;
    }
});

// > Visualize notifications and errors from main process
const showNotification = ref(false);
const notificationText = ref("");
const notificationColor = ref("red-darken-4");
receiveNotifications((type: "error" | "success", text: string) => {

    notificationText.value = text;
    notificationColor.value = type === "error" ? "red-darken-4" : "success";
    showNotification.value = true;
});

</script>

<template>
<div class="layout-top">
  <div v-show="normalScreen" class="layout-west">
    <controls-container />
  </div>
  <div class="layout-gutter" @click="normalScreen = !normalScreen" />
  <viewer3-d :expanded="!normalScreen" />
  <v-snackbar v-model="showNotification" multi-line timeout="6000" timer="info"
              close-on-content-click :color="notificationColor">
    {{ notificationText }}
  </v-snackbar>
</div>
<component :is="loadedPanel" @close-panel="loadedPanel = undefined" />
</template>


<style scoped>

.layout-top {
  height: var(--usable-height);
  display: flex;
  flex-direction: row;
  margin: 0;
  overflow: hidden;
  width: 99.9vw; /* width: 100vw; */
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
