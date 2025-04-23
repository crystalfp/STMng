<script setup lang="ts">
/**
 * @component
 * Node without input and output for the project visualization.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-04-18
 */
import type {NodeProps} from "@vue-flow/core";

defineProps<NodeProps>();

</script>

<template>
  <div class="vue-flow__node-default">
    <div>{{ data.label }}</div>
  </div>
</template>
