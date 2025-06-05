/**
 * Setup router. Besides main entry, one route for each independent window to be created
 * @remarks If the page content does not load, increase the timeout in WindowsUtilities
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {createWebHashHistory, createRouter} from "vue-router";
import type {Component} from "vue";

import LayoutClient from "@/components/LayoutClient.vue";

/** Routes for the external windows created */
export const router = createRouter({
    history: createWebHashHistory(),
    routes:  [
        {
            path: "/",
            component: LayoutClient
        },
        {
            path: "/chart",
            component: (): Component => import("@/components/ChartViewer.vue")
        },
        {
            path: "/project-editor",
            component: (): Component => import("@/components/ProjectEditor.vue")
        },
        {
            path: "/symmetries",
            component: (): Component => import("@/components/ShowSymmetries.vue")
        },
        {
            path: "/log",
            component: (): Component => import("@/components/ShowLog.vue")
        },
        {
            path: "/fp-scatterplot",
            component: (): Component => import("@/components/FingerprintScatterplot.vue")
        },
        {
            path: "/fp-landscape",
            component: (): Component => import("@/components/EnergyLandscape.vue")
        },
        {
            path: "/fp-charts",
            component: (): Component => import("@/components/FingerprintCharts.vue")
        },
        {
            path: "/compare",
            component: (): Component => import("@/components/CompareSelected.vue")
        },
        {
            path: "/displacements",
            component: (): Component => import("@/components/ShowDisplacements.vue")
        },
    ],
});
