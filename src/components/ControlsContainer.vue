<script setup lang="ts">
/**
* @component
* Manage the user interfaces loading and display.
*
* @author Mario Valle "mvalle at ikmail.com"
* @since 2024-07-11
*/
import {mdiAlphaXBoxOutline, mdiAlphaABoxOutline, mdiAlphaHBoxOutline,
        mdiPlusMinusVariant} from "@mdi/js";
import {ref, reactive, defineAsyncComponent, markRaw, watch, computed} from "vue";
import {useControlStore} from "@/stores/controlStore";
import {receiveProjectUI, sendToNode, sendCurrentNode} from "@/services/RoutesClient";

import type {ClientProjectInfo, ClientProjectInfoItem} from "@/types/NodeInfo";

// > Access the store
const controlStore = useControlStore();

const selectedTabId = ref("");

// Don't use shallowRef here
const uiList = reactive<ClientProjectInfoItem[]>([]);
const panelList = reactive<{id: string; label: string; ctrl: unknown}[]>([]);

/** When the project is loaded request the project data */
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
		panelList.push({id, label, ctrl: markRaw(defineAsyncComponent(() => import(`../ui/${ui}.vue`)))});
	}
	selectedTabId.value = uiList[0].id;
});

/* Return to the main process the type of the current node open in the UI */
sendCurrentNode(() => {

	for(const item of uiList) {
		if(item.id === selectedTabId.value) return item.type;
	}
	return "";
});

// > Expanded camera controls
const showPanel = ref(0);
const setCd = (direction: string): void => {

    const vd = controlStore.viewDirection;
    let sign = vd[0] ?? "-";
    let axis = vd[1] ?? "z";
    if(direction === "s") {
        sign = sign === "+" ? "-" : "+";
    }
    else {
        axis = direction;
    }
    controlStore.viewDirection = sign + axis;
};

const lookAxis = ref("z");
watch(lookAxis, (after) => {

    switch(after) {
        case "r":
            controlStore.reset = true;
            controlStore.viewDirection = "";
            break;
        case "0":
            showPanel.value = 1;
            break;
        case "1":
            showPanel.value = hasCell.value ? 2 : 0;
            break;
        case "2":
            showPanel.value = 0;
            break;
        case "":
            return;
        default:
            setCd(after);
            break;
    }
    lookAxis.value = "";
});

const hasCell = computed(() => controlStore.basis.some((b) => b !== 0));

</script>


<template>
<v-container class="pa-0 title-container">
  <v-select v-model="selectedTabId" :items="uiList" item-title="label"
            item-value="id" variant="solo-filled" rounded="0"
            :menu-props="{stickToTarget: true}"/>
</v-container>
<v-container v-for="panel of panelList" :key="panel.id" class="px-2 py-0">
  <component :is="panel.ctrl" v-show="panel.id === selectedTabId"
  			 :id="panel.id" :label="panel.label" />
</v-container>
<v-row class="justify-center w-100">
  <v-spacer />
  <v-col v-if="showPanel===0">
    <v-btn-toggle v-model="lookAxis" mandatory variant="text" :divided="false"
                  rounded="0" class="muted" density="compact">
      <v-btn value="0" :icon="mdiAlphaXBoxOutline"/>
  <v-btn value="r">Reset camera</v-btn>
    </v-btn-toggle>
  </v-col>
  <v-col v-if="showPanel===1">
    <v-btn-toggle v-model="lookAxis" mandatory variant="text" :divided="false"
                  rounded="0" class="muted" density="compact">
      <v-btn value="1" :icon="hasCell ? mdiAlphaABoxOutline : mdiAlphaHBoxOutline"/>
      <v-btn value="x">X</v-btn>
      <v-btn value="y">Y</v-btn>
      <v-btn value="z">Z</v-btn>
      <v-btn value="s" :icon="mdiPlusMinusVariant"/>
    </v-btn-toggle>
  </v-col>
  <v-col v-if="showPanel===2">
    <v-btn-toggle v-model="lookAxis" mandatory variant="text" :divided="false"
                  rounded="0" class="muted" density="compact">
      <v-btn value="2" :icon="mdiAlphaHBoxOutline"/>
      <v-btn value="a">a</v-btn>
      <v-btn value="b">b</v-btn>
      <v-btn value="c">c</v-btn>
      <v-btn value="s" :icon="mdiPlusMinusVariant"/>
    </v-btn-toggle>
  </v-col>
  <v-spacer />
</v-row>
</template>


<style scoped>
.title-container :deep(.v-select__selection-text) {
  font-size: 140%;
}

.muted {
  color: rgb(var(--v-theme-primary), var(--v-medium-emphasis-opacity)) !important
}
</style>
