<script setup lang="ts">
/**
 * @component
 * Spinner for loading user interfaces.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-16
 */
</script>


<template>
<v-container class="container">
  <v-progress-circular
    color="primary"
    :size="43"
    :width="5"
    indeterminate
    class="justify-center align-center"
  />
</v-container>
</template>
