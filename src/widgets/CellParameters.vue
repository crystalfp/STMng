<script setup lang="ts">
/**
 * @component
 * Show the unit cell parameters
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-12-12
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
  <v-label class="mt-4 mb-n1 no-select result-label">Unit cell</v-label>
  <table class="pl-0 pr-6 py-1 text-body-2 w-100">
    <tbody>
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
    </tbody>
  </table>
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
