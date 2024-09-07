<script setup lang="ts">
/**
* @component
* Manage the load of the elements' user interfaces
*
* @author Mario Valle "mvalle\@ikmail.com"
* @since 2024-07-11
*/

import {ref, defineAsyncComponent, markRaw} from "vue";
import {useControlStore} from "../stores/controlStore";
import {receiveProjectUI} from "../services/RoutesClient";
import type {ClientProjectInfo, ClientProjectInfoItem} from "../types";

// > Access the store
const controlStore = useControlStore();

const selectedTabId = ref("");
const uiList = ref<ClientProjectInfoItem[]>([]);
const panelList = ref<unknown[]>([]);

/** When the project is loaded */
receiveProjectUI((clientProjectInfo: ClientProjectInfo) => {
console.log("RECV ---------------"); // TBD
	// Get the node UI list and select the first one
	uiList.value.length = 0;
	panelList.value.length = 0;
	for(const id in clientProjectInfo) {

		const info = clientProjectInfo[id];
		uiList.value.push(info);
		const {ui, label} = info; // TBD label added
console.log(label);
		panelList.value.push(markRaw(defineAsyncComponent(() => import(`../ui/${ui}.vue`))));
	}
	selectedTabId.value = uiList.value[0].id;
});

</script>


<template>
	<v-container class="pa-0 title-container">
		<v-select v-model="selectedTabId" :items="uiList" item-title="label" item-value="id"
		variant="solo-filled" density="compact" hide-details rounded="0" />
	</v-container>
	<v-container v-for="(panel, index) of panelList" class="pa-0">
		<component :is="panel" :id="uiList[index].id" v-show="uiList[index].id === selectedTabId" />
	</v-container>
	<v-btn density="comfortable" variant="tonal" rounded="0" @click="controlStore.reset = true">
		Reset camera
	</v-btn>
</template>


<style>
/* stylelint-disable selector-class-pattern */
.title-container .v-select__selection-text {
	font-size: 140%;
}
</style>
