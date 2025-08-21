<script setup lang="ts">
/**
 * @component
 * Main entry point of the application. It defines the general layout of the screen.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */

import {ref, shallowRef, defineAsyncComponent} from "vue";
import {sm} from "@/services/SceneManager";
import {isLoaded, handleFullscreen, receiveRefreshMenu,
        setProjectPathInTitle, receiveMenuSelection,
        receiveNotifications, sendToNode,
        receiveBroadcast,
        handleExitConfirmation} from "@/services/RoutesClient";
import {showNodeAlert, showSystemAlert} from "@/services/AlertMessage";
import {theme} from "@/services/ReceiveTheme";
import type {AlertLevel} from "@/stores/messageStore";

import Viewer3D from "./Viewer3D.vue";
import ControlsContainer from "./ControlsContainer.vue";

/** Normal/Expanded viewer window */
const normalScreen = ref(true);

// > Answer fullscreen requests and set title
globalThis.addEventListener("DOMContentLoaded", () => {
    let count = 0;
    const timer = setInterval(() => {
        ++count;
        if(count > 50) {
          clearInterval(timer);
          showSystemAlert("Waiting too long for IPC to setup");
        }
        if(isLoaded()) {
            clearInterval(timer);
            handleFullscreen((isFullScreen: boolean) => {
                const root = document.documentElement;
                root.style.setProperty("--container-height", isFullScreen ? "calc(100vh - 90px)" :
                                                                            "calc(100vh - 121px)");
            });
            setProjectPathInTitle("See the Molecole new generation");
            receiveRefreshMenu();
        }
    }, 20);
});

// > The component to load in response to menus selections
const loadedPanel = shallowRef<unknown>();
receiveMenuSelection((menuEntry: string, payload: string) => {

    switch(menuEntry) {
        case "show-versions":
            loadedPanel.value = defineAsyncComponent(() => import("./About.vue"));
            break;
        case "extend-viewer":
            normalScreen.value = payload === "no";
            break;
        case "show-scene":
            sm.dumpScene("Scene 3D");
            break;
        default:
            showSystemAlert(`Menu entry "${menuEntry}" is not implemented`);
            break;
    }
});

// > Visualize notifications and errors from main process
const notificationQueue = ref<{text: string; color: string}[]>([]);
receiveNotifications((type: AlertLevel, text: string, from: string) => {

    notificationQueue.value.push({text, color: type === "error" ? "red-darken-4" : type});
    if(from !== "") showNodeAlert(text, from);
});

/**
 * Toggle normal screen by clicking on the layout separator
 */
const toggleNormalScreen = (): void => {

    // To redraw the scene after toggling extended screen
    sm.modified();

    normalScreen.value = !normalScreen.value;
    sendToNode("SYSTEM", "extended", {normalScreen: normalScreen.value});
};

receiveBroadcast((eventType: string) => {

    if(eventType === "extended-screen") {

        // To redraw the scene after toggling extended screen
        sm.modified();
    }
});

// Application exit confirmation
const showExitConfirm = ref(false);
handleExitConfirmation(() => {
    showExitConfirm.value = true;
});
const confirmedExit = (): void => {
    showExitConfirm.value = false;
    sendToNode("WINDOW", "EXIT-CONFIRMED");
};

</script>

<template>
<v-app :theme class="app-top">
<div class="layout-top">
  <div v-show="normalScreen" class="layout-west">
    <controls-container />
  </div>
  <div class="layout-gutter" @click="toggleNormalScreen" />
  <viewer3-d :expanded="!normalScreen" />
  <v-snackbar-queue v-model="notificationQueue" multi-line timeout="6000"
                    timer="info" max-width="250" close-on-content-click />
</div>
<component :is="loadedPanel" @close-panel="loadedPanel = undefined" />

<v-dialog v-model="showExitConfirm">
  <v-card title="Confirm exit application" text="Do you want to quit the application?"
          class="mx-auto no-select focus-visible-buttons" elevation="16" max-width="500">
  <v-card-actions>
      <v-btn v-focus @click="showExitConfirm=false">Dismiss</v-btn>
      <v-btn @click="confirmedExit">Yes</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
</v-app>
</template>


<style scoped>

.app-top {
  height: 100vh;
}

.layout-top {
  height: 100%;
  display: flex;
  flex-direction: row;
  margin: 0;
  overflow: hidden;
}

.layout-west {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 500px;
  padding: 0;
  margin: 12px 12px 0 12px; /* this currently works */
  /* margin: 0; when fixed vuetify VSelect dropdown menu */
}

.layout-gutter {
  width: 6px;
  background-color: rgb(var(--v-theme-surface-light));
  cursor: pointer;
}
</style>
