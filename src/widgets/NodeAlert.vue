<script setup lang="ts">
/**
 * @component
 * Show an alert (error or success) in the UI container for a given node.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-07-03
 */
import {computed, ref, watch} from "vue";
import {storeToRefs} from "pinia";
import {useMessageStore} from "@/stores/messageStore";

// > Properties
const props = withDefaults(defineProps<{

    /** Module that had generated the message */
    node: string;
    /** Time to make a success message disappears */
    timeout?: number;
}>(), {timeout: 5_000});

const messageStore = useMessageStore();
const {node, level, text} = storeToRefs(messageStore);

const showMessage = ref(false);
const messageTitle = computed(() => (level.value === "error" ? "Error" : "Success!"));
const alertColor = computed(() => (level.value === "error" ? "red-darken-4" : level.value));

let timerID: NodeJS.Timeout;

const closeMessage = (): void => {

    showMessage.value = false;
    node.value = "";
    text.value = "";
    clearTimeout(timerID);
};

watch([node], () => {

    if(node.value === "") {
        if(text.value === "") showMessage.value = false;
        return;
    }
    if(node.value !== props.node) {
        showMessage.value = false;
        return;
    }

    showMessage.value = true;

    if(level.value !== "error" && props.timeout > 0) {
        timerID = setTimeout(() => {
            showMessage.value = false;
            node.value = "";
            text.value = "";
        }, props.timeout);
    }
});

</script>


<template>
<v-alert v-if="showMessage"
         :title="messageTitle"
         :text
         :type="level"
         :color="alertColor"
         density="compact"
         class="cursor-pointer"
         @click="closeMessage" />
</template>
