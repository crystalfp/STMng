<script setup lang="ts">
/**
 * @component
 * Show the application log
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-09-24
 */
import {ref} from "vue";
import {closeWithEscape} from "@/services/CaptureEscape";
import {getPreferenceSync, receiveBroadcast, receiveInWindow, closeWindow} from "@/services/RoutesClient";

/** Receive the theme change */
const theme = ref(getPreferenceSync("Theme", "dark"));
receiveBroadcast((eventType: string, params: (string | boolean)[]) => {
    if(eventType === "theme-change") {
        theme.value = params[0] as string;
    }
});

const text = ref("");

receiveInWindow((data: string) => {

    text.value = data;

    const element = document.querySelector<HTMLTextAreaElement>(".log-text .v-field__input");
    console.log(element);
    if(element) {
        element.scrollTop = element.scrollHeight;
    }
});

/** Close the window on Esc press */
closeWithEscape("/log");

</script>


<template>
<v-app :theme="theme">
  <v-row class="log-box pa-0">
    <v-container class="log-text-container">
      <v-textarea :model-value="text" readonly auto-grow hide-details variant="solo-filled" width="100%" class="log-text" />
    </v-container>
    <v-container class="log-button-strip">
      <v-btn @click="closeWindow('/log')">Close</v-btn>
    </v-container>
  </v-row>
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
  margin-bottom: 10px;
}
</style>
