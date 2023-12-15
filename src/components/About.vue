<script setup lang="ts">
/**
 * @component
 * Ask the main process for the versions of the application, Node, Electron and Chrome
 * and display them in a Modal dialog.
 */
import {reactive} from "vue";
import {getVersions, type Versions} from "@/services/RoutesClient";
import ModalDialog from "@/widgets/ModalDialog.vue";

// > Events
const emit = defineEmits<{
	/** Communicate with the parent component to close this component */
	"close-panel": [];
}>();

const versions = reactive<Versions>({app: "", node: "", electron: "", chrome: ""});
const isDevelopment = import.meta.env.DEV;

void getVersions().then((receivedVersions) => {

    versions.chrome   = receivedVersions.chrome;
    versions.electron = receivedVersions.electron;
    versions.app      = receivedVersions.app;
    versions.node     = receivedVersions.node;
});
</script>


<template>
<modal-dialog title="About STMng"
              close-tooltip="Return to the application"
              @close="emit('close-panel')">
  <template #content>
    <div class="message">See the molecule New Generation is a visualization tool
                         that implements some of the STM4 functionalities.</div>
    <table>
      <tr><td class="c1">STMng:</td><td>{{ versions.app }}</td></tr>
      <tr><td class="c1">Electron:</td><td>{{ versions.electron }}</td></tr>
      <tr><td class="c1">Chromium:</td><td>{{ versions.chrome }}</td></tr>
      <tr><td class="c1">Node:</td><td>{{ versions.node }}</td></tr>
    </table>
    <div v-if="isDevelopment" class="message">Currently running in the development environment</div>
  </template>
</modal-dialog>
</template>


<style scoped lang="scss">

.c1 {
  width: 5rem;
}

.message {
  max-width: 21rem;
  margin: 5px 0 0.5rem 5px;
}

table {
  font-size: 0.8rem;
  margin: 0.5rem 5px;
}
</style>
