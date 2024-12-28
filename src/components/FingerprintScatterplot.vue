<script setup lang="ts">
/**
 * @component
 * Show scatterplot resulting from fingerprint computation.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-26
 */
// import {ref} from "vue";
import {closeWithEscape} from "@/services/CaptureEscape";
import {receiveInWindow} from "@/services/RoutesClient";
import {theme} from "@/services/ReceiveTheme";

interface ScatterplotData {
    points: number[][];
}

/** Receive the chart data from the main window */
receiveInWindow((dataFromMain) => {

    const data = JSON.parse(dataFromMain) as ScatterplotData;
    const points = scaleForDisplay(data.points);
    console.log("Receiving points", points); // TBD
});

/**
 * Scale coordinates for display
 *
 * @param coordinates - Computed coordinates in 2D
 * @returns Points with coordinates scaled between 0 and 1
 */
const scaleForDisplay = (coordinates: number[][]): number[][] => {

    // 6. Normalize coordinates between 0 and 1
    let maxX = Number.NEGATIVE_INFINITY;
    let minX = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    for(const point of coordinates) {

        if(point[0] > maxX) maxX = point[0];
        if(point[0] < minX) minX = point[0];
        if(point[1] > maxY) maxY = point[1];
        if(point[1] < minY) minY = point[1];
    }

    let denX = maxX - minX;
    if(denX < 1e-10) denX = 1;
    let denY = maxY - minY;
    if(denY < 1e-10) denY = 1;

    const n = coordinates.length;
    const out: number[][] = Array(n) as number[][];
    for(let i=0; i < n; ++i) {

        out[i] = [
            (coordinates[i][0] - minX)/denX,
            (coordinates[i][1] - minY)/denY,
        ];
    }

    return out;
};

void scaleForDisplay;


/** Close the window on Esc press */
closeWithEscape("/scatter");

</script>


<template>
<v-app :theme="theme">
</v-app>
</template>


<style scoped lang="scss">

</style>
