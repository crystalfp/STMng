/**
 * Setup router. Besides main entry, one route for each independent window to be created
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
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
import {createWebHashHistory, createRouter} from "vue-router";
import {h, type Component} from "vue";

import LayoutClient from "@/components/LayoutClient.vue";

/** Routes for the main and the secondary windows created */
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
            path: "/fp-export",
            component: (): Component => import("@/components/FingerprintExport.vue")
        },
        {
            path: "/compare",
            component: (): Component => import("@/components/CompareSelected.vue")
        },
        {
            path: "/displacements",
            component: (): Component => import("@/components/ShowDisplacements.vue")
        },
        {
            path: "/prototype",
            component: (): Component => import("@/components/ShowPrototype.vue")
        },
        {
            path: "/matches",
            component: (): Component => import("@/components/ShowMatches.vue")
        },
        {
            path: "/components-hull",
            component: (): Component => import("@/components/ComponentsConvexHull.vue")
        },
        {
            // Catch errors in paths
            path: "/:catchAll(.*)*",
            name: "NotFound",
            component: h("p", {style: "color: red; margin: 1rem"}, "Page not found")
        }
    ],
});
