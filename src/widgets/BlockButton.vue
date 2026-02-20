<script setup lang="ts">
/**
 * @component
 * <<DESCRIPTION>>
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-20
 */

 // > Properties & events
withDefaults(defineProps<{

    /** Label for the button */
    label: string;

    /** Button disable */
    disabled?: boolean;

  }>(), {

    disabled: false
});

const emit = defineEmits<{
    /** The button has been pressed */
    click: [];
}>();

</script>


<template>
<v-container class="pl-0 pt-0 pr-2">
  <v-btn block :disabled @click="emit('click')">{{ label }}</v-btn>
</v-container>
</template>
