<script setup lang="ts">

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {mdiRectangle} from "@mdi/js";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

const showPolyhedra = ref(true);
const surfaceColor = ref("#FFFFFF80");
const surfaceColorShow = ref(false);

sb.getUiParams(props.id, (params: UiParams) => {
    showPolyhedra.value = params.showPolyhedra as boolean ?? false;
    surfaceColor.value = params.surfaceColor as string ?? "#FFFFFF80";
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        showPolyhedra: showPolyhedra.value,
        surfaceColor: surfaceColor.value
    });
});
</script>


<template>
<v-container class="container">
  <v-switch v-model="showPolyhedra" color="primary" label="Show polyhedra" density="compact" class="mt-2 ml-2" />
  <v-btn class="mb-6" @click="surfaceColorShow = !surfaceColorShow">
    <template #append>
      <v-icon :icon="mdiRectangle" :color="surfaceColor" size="x-large" />
    </template>
    Surface color
  </v-btn>
  <v-color-picker v-if="surfaceColorShow" v-model="surfaceColor" :modes="['rgba', 'hsla', 'hexa']" elevation="0" />
</v-container>
</template>
