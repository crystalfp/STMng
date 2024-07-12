<script setup lang="ts">
/**
 * @component
 * Manage the load of the elements' user interfaces
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-11
 */

import {ref, shallowRef, defineAsyncComponent} from "vue";
import {useControlStore} from "@/stores/controlStore";
import {receiveProjectUI} from "../../new/services/RoutesClient";
import type {ClientProjectInfo, ClientProjectInfoItem} from "../../new/types";

import LoadingComponent from "@/components/Loading.vue";

// > Access the store
const controlStore = useControlStore();

const selectedTabId = ref("");
const loadedPanel = shallowRef<unknown>();
const uiList = ref<ClientProjectInfoItem[]>([]);

/** When the project is loaded */
receiveProjectUI((clientProjectInfo: ClientProjectInfo) => {

	// Get the node UI list and select the first one
    uiList.value.length = 0;
    for(const id in clientProjectInfo) {
        uiList.value.push(clientProjectInfo[id]);
    }
	  selectedTabId.value = uiList.value[0].id;

	// Select and load the first panel
	const {ui} = clientProjectInfo[selectedTabId.value];
	loadedPanel.value = ui === "" ?
							undefined :
							defineAsyncComponent({
									loader: () => import(`../../new/ui/${ui}.vue`),
									loadingComponent: LoadingComponent,
									delay: 200,
							});
});

/**
 * Select a panel
 *
 * @param id - ID of the node selected with the selector
 */
const selectPanel = (id: string): void => {

    for(const item of uiList.value) {

        if(id === item.id) {

            loadedPanel.value = item.ui === "" ?
									undefined :
									defineAsyncComponent({
											loader: () => import(`../../new/ui/${item.ui}.vue`),
											loadingComponent: LoadingComponent,
											delay: 200,
									});
			      break;
        }
    }
};

</script>


<template>
	<v-container class="pa-0 title-container">
		<v-select v-model="selectedTabId" :items="uiList" item-title="label" item-value="id"
							variant="solo-filled" density="compact" hide-details rounded="0"
							@update:model-value="selectPanel" />
	</v-container>
	<keep-alive>
		<component :is="loadedPanel" :id="selectedTabId" />
	</keep-alive>
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
