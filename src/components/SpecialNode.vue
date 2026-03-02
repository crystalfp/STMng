<script setup lang="ts">
/**
 * @component
 * Node without input and output for the project visualization.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-04-18
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import type {NodeProps} from "@vue-flow/core";

// eslint-disable-next-line vue/no-unused-properties
defineProps<NodeProps>();

</script>

<template>
<div>
  <div>{{ data.label }}</div>
</div>
</template>
