<script setup lang="ts">
/**
 * @component
 * Widget to select a file. The selector is called in the main process
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-08-22
 */
import {ref, toRefs} from "vue";
import {mdiFileOutline} from "@mdi/js";
import {askNode} from "../services/RoutesClient";
import {showAlertMessage} from "../services/AlertMessage";

// > Properties and emits
const props = defineProps<{

    /** Disable the widget */
    disabled?: boolean;

    /** If the selector is for an existing file to be read or a new file to be saved */
    kind?: "load" | "save";

    /** Title for the display field */
    title: string;

    /** JSON encoded filter for the file selector */
    filter: string;
}>();

const {
    disabled=false,
    title,
    filter
} = toRefs(props);
const kind = props.kind ?? "load";

const emit = defineEmits<{
    /** The file has been selected */
    "selected": [filename: string];
}>();

/** Label to be show (the file selected) */
const label = ref("");
/** True if the file is loading */
const inProgress = ref(false);

const openSelector = (): void => {

    inProgress.value = true;
    askNode("SYSTEM", "select", {kind, title: title.value, filter: filter.value})
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
<v-row :disabled="disabled" @click="openSelector">
  <v-icon :icon="mdiFileOutline" size="large" class="ml-4 mr-2 mt-1" style="opacity: 0.6" />
  <v-text-field :model-value="label" :disabled="disabled" :label="title" readonly
                class="mb-2 mr-2" hide-details="auto" :loading="inProgress" spellcheck="false" />
</v-row>
</template>
