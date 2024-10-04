<script setup lang="ts">
/**
 * @component
 * Widget to select a file. The selector is called in the main process
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-08-22
 */
import {ref} from "vue";
import {mdiFileOutline} from "@mdi/js";
import {askNode} from "@/services/RoutesClient";
import {showAlertMessage} from "@/services/AlertMessage";

// > Properties and emits
const props = withDefaults(defineProps<{

    /** Disable the widget */
    disabled?: boolean;

    /** If the selector is for an existing file to be read ("load") or a new file to be saved ("save") */
    kind?: "load" | "save";

    /** Title for the display field */
    title: string;

    /** JSON encoded filter for the file selector */
    filter: string;
}>(), {
    disabled: false,
    kind: "load"
});

const emit = defineEmits<{
    /** The filename that has been selected */
    selected: [filename: string];
}>();

/** Label to be show (the file selected) */
const label = defineModel<string>();
label.value = "";

/** True if the file is loading */
const inProgress = ref(false);

/**
 * Start selecting file by clicking on the widget
 */
const openSelector = (): void => {

    inProgress.value = true;
    askNode("SYSTEM", "select", {kind: props.kind, title: props.title, filter: props.filter})
        .then((params) => {

            const filename = params.filename as string;
            if(filename) {
                const pos = filename.lastIndexOf("/");
                label.value = filename.slice(pos+1);
                emit("selected", filename);
            }
        })
        .catch((error: Error) => showAlertMessage(`Error from file select: ${error.message}`))
        .finally(() => inProgress.value = false);
};

</script>


<template>
<v-text-field :model-value="label" :disabled="disabled" :label="title" readonly :prepend-icon="mdiFileOutline"
              class="mb-2 mr-0 ml-2 cursor-pointer" hide-details="auto" :loading="inProgress" spellcheck="false"
              @click="openSelector"/>
</template>
