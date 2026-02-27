<script setup lang="ts">
/**
 * @component
 * Widget to select a file. The selector is called in the main process.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-08-22
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import {onUnmounted, ref, watchEffect} from "vue";
import {mdiFileOutline} from "@mdi/js";
import {askNode} from "@/services/RoutesClient";
import {showSystemAlert} from "@/services/AlertMessage";
import {useControlStore} from "@/stores/controlStore";

// > Properties and emits
const props = withDefaults(defineProps<{

    /** Disable the widget */
    disabled?: boolean;

    /** If the selector is for an existing file to be read ("load")
     * or a new file to be saved ("save") */
    kind?: "load" | "save";

    /** Title for the file selector */
    title: string;

    /** Title for the display field */
    label?: string;

    /** JSON encoded filter for the file selector */
    filter: string;
}>(), {
    disabled: false,
    kind: "load"
});

const emit = defineEmits<{
    /** The filename that has been selected */
    selected: [filename: string];
    /** The dropped file content */
    dropped: [content: string, filename: string];
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
        .finally(() => {inProgress.value = false;})
        .catch((error: Error) => {
            showSystemAlert(`Error from file select: ${error.message}`);
        });
};

// > Drag and drop support

/** Class to mark drop target */
const dropActive = ref("placeholder");

// To show the drop target on entering the application
const controlStore = useControlStore();
const stopWatcher = watchEffect(() => {

    dropActive.value = props.kind === "load" &&
                       !props.disabled &&
                       controlStore.draggingFile ? "drop" : "placeholder";
});

// Cleanup
onUnmounted(() => stopWatcher());

/**
 * On dropping a file
 *
 * @param event - Drop event
 */
const onDrop = (event: DragEvent): void => {

    dropActive.value = "placeholder";

    const dt = event.dataTransfer;
    if(!dt) return;

    inProgress.value = true;

    const filename = dt.files[0].name;
    dt.files[0].text()
        .then((content: string) => {
            label.value = filename;
            emit("dropped", content, filename);
        })
        .finally(() => {inProgress.value = false;})
        .catch((error: Error) => {
            label.value = "";
            showSystemAlert(`Error from file drop: ${error.message}`);
        });
};

/**
 * Check if the file could be dropped
 *
 * @param event - Drop event
 */
const onDragOver = (event: DragEvent): void => {

    const dt = event.dataTransfer;
    if(!dt) return;
    if(dt.types.includes("Files") && props.kind === "load" && !props.disabled) {
        dt.dropEffect = "move";
        dropActive.value = "drop";
    }
    else dt.dropEffect = "none";
};

/**
 * Remove the drop zone marker on leaving
 */
const onDragLeave = (): void => {
    // dropActive.value = "placeholder";
};

</script>

<template>
<div :class="dropActive"
      @drop.prevent="onDrop"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave">
  <v-text-field :model-value="label" :disabled :label="props.label ?? props.title"
                readonly :prepend-icon="mdiFileOutline"
                class="mb-2 cursor-pointer" hide-details="auto"
                :loading="inProgress" spellcheck="false"
                @click="openSelector" />
</div>
</template>

<style scoped>
.drop {
  border: 6px dashed red;
  border-radius: 12px;
  /* background-color: gray; */
  padding: 10px 8px 6px 0;
}

.placeholder {
  border: 6px solid transparent;
  padding: 10px 8px 6px 0;
}
</style>
