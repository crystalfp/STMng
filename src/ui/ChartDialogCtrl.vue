<script setup lang="ts">
import {createWindow} from "@/services/RoutesClient";

const openChart = (): void => {

    const dataToSend = JSON.stringify({
                x: [1, 2, 3],
                y: [12, 7.5, 9]
            });

    createWindow({
                    routerPath: "/chart",
                    width: 800,
                    height: 600,
                    title: "Chart example",
                    data: dataToSend
                });
};

</script>


<template>
<v-container class="container">
    <v-btn @click="openChart">Open Chart</v-btn>
</v-container>
</template>
