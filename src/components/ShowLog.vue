<script setup lang="ts">
/**
 * @component
 * Show the application log. Can also clean it.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-09-24
 */
import {ref} from "vue";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {receiveInWindow, closeWindow, clearLog} from "@/services/RoutesClient";
import {theme} from "@/services/ReceiveTheme";

const text = ref("");
const showConfirm = ref(false);

receiveInWindow((data: string) => {

    text.value = data;

    const element = document.querySelector<HTMLTextAreaElement>(".log-text-container");

    if(element) {
        setTimeout(() => {element.scrollTop = element.scrollHeight;}, 10);
    }
});

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys("/log");

/**
 * Ask confirmation for deleting the log content
 */
const confirmDeletion = (): void => {

    showConfirm.value = false;
    clearLog();
    text.value = "";
};

</script>


<template>
<v-app :theme>
  <v-row class="log-box pa-0">
    <v-container class="log-text-container">
      <v-textarea :model-value="text" readonly auto-grow hide-details
                  variant="underlined" flat width="100%" class="pl-2" />
    </v-container>
    <v-container class="button-strip">
      <v-btn @click="showConfirm=true">Empty Log</v-btn>
      <v-btn v-focus @click="closeWindow('/log')">Close</v-btn>
    </v-container>
  </v-row>

  <v-dialog v-model="showConfirm">
    <v-card title="Confirm" text="Do you want to clear the application log file?"
            class="mx-auto no-select" elevation="16" max-width="500">
    <v-card-actions>
        <v-btn v-focus @click="showConfirm=false">Dismiss</v-btn>
        <v-btn @click="confirmDeletion">Yes</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</v-app>
</template>

<style scoped>
.log-box {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  margin: 0;
}

.log-text-container {
  flex: 2;
  width: 100%;
  overflow-y: auto;
  max-width: 3000px !important;
  padding: 0;
}

</style>
