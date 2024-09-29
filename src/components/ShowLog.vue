<script setup lang="ts">
/**
 * @component
 * Show the application log
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-09-24
 */
import {ref, shallowRef} from "vue";
import {closeWithEscape} from "@/services/CaptureEscape";
import {receiveInWindow, closeWindow, clearLog} from "@/services/RoutesClient";
import {theme} from "@/services/ReceiveTheme";

const text = ref("");

receiveInWindow((data: string) => {

    text.value = data;

    const element = document.querySelector<HTMLTextAreaElement>(".log-text-container");

    if(element) {
        setTimeout(() => {element.scrollTop = element.scrollHeight;}, 10);
    }
});

/** Close the window on Esc press */
closeWithEscape("/log");

const showConfirm = shallowRef(false);
const confirmDeletion = (): void => {

    showConfirm.value = false;
    clearLog();
    text.value = "";
};

</script>


<template>
<v-app :theme="theme">
  <v-row class="log-box pa-0">
    <v-container class="log-text-container">
      <v-textarea :model-value="text" readonly auto-grow hide-details variant="underlined" width="100%" class="log-text pl-2" />
    </v-container>
    <v-container class="log-button-strip">
      <v-btn variant="tonal" @click="showConfirm=true">Empty Log</v-btn>
      <v-btn v-focus variant="tonal" @click="closeWindow('/log')">Close</v-btn>
    </v-container>
  </v-row>
</v-app>

<v-dialog v-model="showConfirm">
  <v-card title="Confirm" text="Do you want to clear the application log file?"
          class="mx-auto" elevation="16" max-width="500">
   <v-card-actions>
      <v-btn @click="showConfirm=false">Dismiss</v-btn>
      <v-btn @click="confirmDeletion">Yes</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
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
    max-width: 100%;
    padding: 0;
}

.log-button-strip {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 10px;
  width: 100vw;
  max-width: 100%;
  margin-bottom: 3px;
  gap: 10px
}
</style>
