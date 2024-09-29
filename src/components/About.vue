<script setup lang="ts">
/**
 * @component
 * Ask the main process for the versions of the application, Node, Electron
 * and Chrome and display them in a dialog.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {reactive, ref, version as VueVersion} from "vue";
import {REVISION} from "three";
import {getVersions, type Versions} from "@/services/RoutesClient";

// > Events
const emit = defineEmits<{
	/** Communicate with the parent component to close this component */
	"close-panel": [];
}>();

const versions = reactive<Versions>({app: "", node: "", electron: "", chrome: ""});
const isDevelopment = import.meta.env.DEV;
const isOpen = ref(true);

getVersions()
    .then((receivedVersions) => {

        versions.chrome   = receivedVersions.chrome;
        versions.electron = receivedVersions.electron;
        versions.app      = receivedVersions.app;
        versions.node     = receivedVersions.node;
    })
    .catch((error: Error) => {
        versions.chrome   = error.message;
        versions.electron = error.message;
        versions.app      = error.message;
        versions.node     = error.message;
    });

</script>


<template>
<v-dialog v-model="isOpen" width="26rem">
  <v-card>
    <v-card-text class="pl-2">
      <div class="ml-2 mt-1 text-body-1">See The Molecule new generation (STMng) is a
            visualization tool that implements some of the STM4 functionalities.</div>
      <div class="mb-4 ml-2 mt-3 text-body-1">Author: Mario Valle
           (<a href="mailto:mvalle@ikmail.com">mvalle@ikmail.com</a>).</div>
      <table class="text-body-2 ml-2">
        <tbody>
          <tr><td class="w-50">STMng:</td><td>{{ versions.app }}</td></tr>
          <tr><td class="w-50">Electron:</td><td>{{ versions.electron }}</td></tr>
          <tr><td class="w-50">Chromium:</td><td>{{ versions.chrome }}</td></tr>
          <tr><td class="w-50">Node:</td><td>{{ versions.node }}</td></tr>
          <tr><td class="w-50">Three.js:</td><td>{{ REVISION }}</td></tr>
          <tr><td class="w-50">Vue:</td><td>{{ VueVersion }}</td></tr>
        </tbody>
      </table>
      <div v-if="isDevelopment" class="mt-4 ml-2 text-body-1">Currently running in the development environment</div>
    </v-card-text>
    <v-card-actions>
      <v-btn v-focus variant="tonal" @click="isOpen = false; emit('close-panel')">Close</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
</template>
