<script setup lang="ts">
/**
 * @component
 * Show the application log. Can also clean it.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-09-24
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import {ref, useTemplateRef} from "vue";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {requestData, closeWindow, clearLog} from "@/services/RoutesClient";
import {theme} from "@/services/ReceiveTheme";
import type {CtrlParams} from "@/types";

const text = ref("");
const showConfirm = ref(false);
const windowPath = "/log";

requestData(windowPath, (params: CtrlParams) => {

    text.value = params.content as string ?? "";

    const element = document.querySelector<HTMLTextAreaElement>(".layout-main");

    if(element) {
        setTimeout(() => {element.scrollTop = element.scrollHeight;}, 10);
    }
});

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

/**
 * Ask confirmation for deleting the log content
 */
const confirmDeletion = (): void => {

    showConfirm.value = false;
    clearLog();
    text.value = "";
};

const copyText = useTemplateRef<HTMLTextAreaElement>("txt");

/**
 * Copy the content of the application log to the clipboard
 */
const copyToClipboard = async (): Promise<void> => {

    if(!copyText.value) return;

    // Select the text field
    copyText.value.select();

    // Copy the text inside the text field
    await navigator.clipboard.writeText(copyText.value.value);
};

</script>


<template>
<v-app :theme class="layout-app">
  <v-container class="layout-main">
    <v-textarea ref="txt" :model-value="text" readonly auto-grow hide-details
                  variant="underlined" flat width="100%" class="pl-2" />
  </v-container>
  <v-container class="layout-buttons">
    <v-btn @click="showConfirm=true">Wipe log</v-btn>
    <v-btn :disabled="!copyText" @click="copyToClipboard">Copy to clipboard</v-btn>
    <v-btn v-focus @click="closeWindow(windowPath)">Close</v-btn>
  </v-container>
</v-app>

<v-dialog v-model="showConfirm">
  <v-card title="Confirm" text="Do you want to clear the application log file?"
          class="mx-auto no-select focus-visible-buttons" elevation="16" max-width="500">
    <v-card-actions>
      <v-btn v-focus @click="showConfirm=false">Dismiss</v-btn>
      <v-btn @click="confirmDeletion">Yes</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
</template>
