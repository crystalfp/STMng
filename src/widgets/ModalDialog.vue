<script setup lang="ts">
/**
 * @component
 * Create a modal dialog with a close button. Can be highly customized.
 */
import {mdiClose} from "@mdi/js";
import {onMounted} from "vue";
import ProgressIndicator from "@/widgets/ProgressIndicator.vue";

// > Properties & events
withDefaults(defineProps<{
    /** Title for the modal dialog */
    title: string;

    /** Label for the close button */
    closeLabel?: string;

    /** Tooltip to show on the close button */
    closeTooltip?: string;

    /** Do not show the close button */
    showProgress?: string;

    /** Change progress indicator from running to finish */
    finish?: boolean;
}>(), {
    closeLabel: "Close",
    closeTooltip: "Close dialog",
    showProgress: "no",
    finish: false
});

const emit = defineEmits<{

    /** Close the modal dialog */
    close: [];

    /** When the modal dialog is mounted */
    mount: [];
}>();

// > Open dialog when mounted
onMounted(() => {
    emit("mount");
    const dialog = document.querySelector(".modal-dialog-core") as HTMLDialogElement;
    dialog.showModal();
});

// > Close the modal dialog
const closeDialog = (): void => {
    emit("close");
    const dialog = document.querySelector(".modal-dialog-core") as HTMLDialogElement;
    dialog.close();
};

// > Close by Esc key
const captureEscape = (event: KeyboardEvent): void => {
    if(event.key === "Escape") {
        closeDialog();
        event.preventDefault();
        document.removeEventListener("keydown", captureEscape);
    }
};
document.addEventListener("keydown", captureEscape);

</script>


<template>
<dialog class="modal-dialog-core">
  <div class="modal-titlebar">
    <span class="modal-title">{{ title }}</span>
    <span class="modal-close"><MdiSvg :path="mdiClose" @click="closeDialog" /></span>
  </div>
  <div class="modal-content">
    <!-- @slot Here add the dialog content -->
    <slot name="content" />
  </div>
  <div class="modal-buttons">
    <!-- @slot Here add buttons on the left of the close button -->
    <slot name="buttons" />
    <button v-if="showProgress !== 'yes'" v-focus
            v-tooltip="{content: closeTooltip, placement: 'top-end'}"
            @click="closeDialog">{{ closeLabel }}</button>
    <progress-indicator v-else v-focus running-label="Running..." :finish-label="closeLabel"
                        :finish="finish"
                        running-tooltip="Stop the running loader"
                        :finish-tooltip="closeTooltip"
                        @click="closeDialog" />

  </div>
</dialog>
</template>


<style lang="scss">

@use "@/styles/colors";

.modal-dialog-core::backdrop {
  position: fixed;
  inset: 0;
  backdrop-filter: blur(10px);
  content-visibility: auto;
  transform: translateZ(0);
  pointer-events: none;
}

// > The whole dialog
.modal-dialog-core {
  background-color: colors.$background;
  padding: 0;
  border: 1px solid colors.$border;
  border-radius: 6px;
  width: fit-content;
  position: relative;
  margin: auto;
  content-visibility: auto;
  display: flex;
  flex-direction: column;
  max-width: 70%;
  min-width: 25%;
  max-height: 100%;
  color: colors.$text;

  // >> Dialog titlebar
  .modal-titlebar {
    display: flex;
    background-color: colors.$dialog-titlebar-color;
    border-radius: 6px 6px 0 0;
    justify-content: space-between;
    padding-left: 10px;
    height: 32px;

    // >> The modal dialog title
    .modal-title {
      color: colors.$dialog-title-color;
      line-height: 32px;
      font-size: 1.2rem;
      user-select: none;
    }

    // The close button
    .modal-close {
      color: colors.$dialog-title-color;
      padding: 3px 5px 0 5px;
      margin: 0;

      &:is(:hover, :focus) {
        color: colors.$button-text;
        text-decoration: none;
        cursor: pointer;
        background-color: colors.$dialog-close-color;
      }
    }
  }

  // >> The slot for the dialog content
  .modal-content {
    padding: 5px;
    max-width: 65rem;

    select {
      width: 100%;
    }

    fieldset {
      margin: 7px 3px;
      padding-top: 5px;
    }

    label {
      margin-right: 10px;
    }
  }
}

// >> The bottom buttons
.modal-buttons {
  display: flex;
  justify-content: flex-end;
  margin: 10px;
  column-gap: 10px;

  button {
    width: 6.5rem;
    font-size: 1.1rem;
  }
}

</style>
