<script setup lang="ts">
/**
 * @component
 * Show an error alert in the ui container for a given node
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-08-15
 */
import {resetAlertMessage, hasAlertMessage, getAlertMessage} from "../services/AlertMessage";

// > Properties
const {kind} = defineProps<{

    /** Module that generates messages */
    kind: string;
}>();

</script>


<template>
<v-alert v-if="hasAlertMessage(kind)" title="Error" class="mt-7 cursor-pointer"
         :text="getAlertMessage(kind)" type="error" density="compact"
         color="red" @click="resetAlertMessage(kind)" />
</template>
