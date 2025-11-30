<script setup lang="ts">
/**
 * @component
 * Button with dead time after one activation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-11-30
 */

 // > Properties & events
const props = withDefaults(defineProps<{

    /** Label for the button */
    label?: string;

    /** Timeout for debouncing (in milliseconds) */
    timeout?: number;

    /** Button disable */
    disabled?: boolean;

  }>(), {

    label: "Push me!",
    timeout: 500,
    disabled: false
});

const emit = defineEmits<{
    /** The button has been pressed */
    click: [];
}>();

/** Button is in the dead-time period */
let waiting = false;

/**
 * Button activated
 */
const click = (): void => {

    if(waiting) return;
    setTimeout(() => {waiting = false;}, props.timeout);
    waiting = true;
    emit("click");
};

</script>


<template>
<v-btn :disabled @click="click">{{ label }}</v-btn>
</template>
