<script setup lang="ts">
/**
* @component
* Manage the user interfaces loading and display.
*
* @author Mario Valle "mvalle at ikmail.com"
* @since 2024-07-11
*/
import {ref, reactive, defineAsyncComponent, markRaw} from "vue";
import {useControlStore} from "@/stores/controlStore";
import {receiveProjectUI, sendToNode, sendCurrentNode} from "@/services/RoutesClient";

import type {ClientProjectInfo, ClientProjectInfoItem} from "@/types/NodeInfo";

import SetCamera from "./SetCamera.vue";

// > Access the store
const controlStore = useControlStore();

const selectedTabId = ref("");

// Don't use shallowRef here
const uiList = reactive<ClientProjectInfoItem[]>([]);
const panelList = reactive<{id: string; label: string; ctrl: unknown}[]>([]);

// Request the project data when the project is loaded
sendToNode("SYSTEM", "project");

receiveProjectUI((clientProjectInfo: ClientProjectInfo) => {

	// Reset indicators to prepare for the new set of loaded modules
	controlStore.resetCapabilityIndicators();

	// Get the node UI list and select the first one
	uiList.length = 0;
	panelList.length = 0;
	for(const id in clientProjectInfo) {

		const info = clientProjectInfo[id];
		uiList.push(info);
		const {ui, label} = info;
		panelList.push({
            id,
            label,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            ctrl: markRaw(defineAsyncComponent(async () => import(`../ui/${ui}.vue`)))
        });
	}
	selectedTabId.value = uiList[0].id;
});

// Return to the main process the type of the current node open in the UI
sendCurrentNode(() => {

	for(const item of uiList) {
		if(item.id === selectedTabId.value) return item.type;
	}
	return "";
});

</script>


<template>
<v-container class="pa-0 title-container">
  <v-select v-model="selectedTabId" :items="uiList" item-title="label"
            item-value="id" variant="solo-filled" rounded="0"
            :menu-props="{stickToTarget: true}"/>
</v-container>
<v-container v-for="panel of panelList" :key="panel.id" class="pl-2 pr-0 py-0">
  <component :is="panel.ctrl" v-show="panel.id === selectedTabId"
  			 :id="panel.id" :label="panel.label" />
</v-container>
<set-camera />
</template>


<style scoped>
.title-container :deep(.v-select__selection-text) {
  font-size: 140%;
}
</style>
