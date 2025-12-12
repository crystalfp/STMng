<script setup lang="ts">
/**
 * @component
 * Show the unit cell parameters
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-12-12
 */

// > Properties
const props = defineProps<{

    /** Unit cell sides */
    sides: number[];

    /** Unit cell angles */
    angles: number[];

    /** Optional cell origin */
    origin?: number[];
}>();

const showOrigin = props.origin !== undefined;

</script>


<template>
<v-container v-if="sides[0] > 0" class="pa-0">
  <v-label class="mt-4 mb-1 no-select result-label">Unit cell</v-label>
  <v-table class="pl-2 pr-4 py-1">
    <tr>
      <td>Sides:</td>
      <td class="w-4 right">{{ sides[0].toFixed(3) }}</td>
      <td class="w-4 right">{{ sides[1].toFixed(3) }}</td>
      <td class="w-4 right">{{ sides[2].toFixed(3) }}</td>
    </tr>
    <tr>
      <td>Angles:</td>
      <td class="w-4 right">{{ angles[0].toFixed(3) }}</td>
      <td class="w-4 right">{{ angles[1].toFixed(3) }}</td>
      <td class="w-4 right">{{ angles[2].toFixed(3) }}</td>
    </tr>
    <tr v-if="showOrigin">
      <td>Origin:</td>
      <td class="w-4 right">{{ origin![0].toFixed(3) }}</td>
      <td class="w-4 right">{{ origin![1].toFixed(3) }}</td>
      <td class="w-4 right">{{ origin![2].toFixed(3) }}</td>
    </tr>
  </v-table>
</v-container>
</template>


<style scoped>
.right {
  text-align: right
}

.w-4 {
  width: 4rem
}
</style>
