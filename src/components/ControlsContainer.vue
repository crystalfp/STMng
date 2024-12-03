<script setup lang="ts">
/**
* @component
* Manage the user interfaces loading.
*
* @author Mario Valle "mvalle\@ikmail.com"
* @since 2024-07-11
*/

import {ref, defineAsyncComponent, markRaw} from "vue";
import {useControlStore} from "@/stores/controlStore";
import {receiveProjectUI, sendToNode, sendCurrentNode} from "@/services/RoutesClient";

import type {ClientProjectInfo, ClientProjectInfoItem} from "@/types";

// > Access the store
const controlStore = useControlStore();

const selectedTabId = ref("");
const uiList = ref<ClientProjectInfoItem[]>([]);
const panelList = ref<{id: string; label: string; ctrl: unknown}[]>([]);

/** When the project is loaded require the project data */
sendToNode("SYSTEM", "project");

receiveProjectUI((clientProjectInfo: ClientProjectInfo) => {

	// Get the node UI list and select the first one
	uiList.value.length = 0;
	panelList.value.length = 0;
	for(const id in clientProjectInfo) {

		const info = clientProjectInfo[id];
		uiList.value.push(info);
		const {ui, label} = info;
		panelList.value.push({id, label, ctrl: markRaw(defineAsyncComponent(() => import(`../ui/${ui}.vue`)))});
	}
	selectedTabId.value = uiList.value[0].id;
});

/* Return to the main process the type of the current node open in the UI */
sendCurrentNode(() => {

	for(const item of uiList.value) {
		if(item.id === selectedTabId.value) return item.type;
	}
	return "";
});

</script>


<template>
<v-container class="pa-0 title-container">
  <v-select v-model="selectedTabId" :items="uiList" item-title="label" item-value="id"
  variant="solo-filled" density="compact" hide-details rounded="0" />
</v-container>
<v-container v-for="panel of panelList" :key="panel.id" class="pa-0">
  <component v-show="panel.id === selectedTabId" :is="panel.ctrl" :id="panel.id" :label="panel.label" />
</v-container>
<v-btn density="comfortable" variant="tonal" rounded="0"
       @click="controlStore.reset = true" class="mb-n4">Reset camera</v-btn>
</template>


<style>
/* Style cannot be scoped */
.title-container .v-select__selection-text {
  font-size: 140%;
}
</style>
