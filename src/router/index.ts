/**
 * Setup router. Besides main entry, one for each independent window to be created
 * @remarks If the page content does not load, increase the timeout in WindowsUtilities
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {createWebHashHistory, createRouter} from "vue-router";

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
            component: () => import("@/components/ChartViewer.vue")
        },
        {
            path: "/editor",
            component: () => import("@/components/ProjectEditor.vue")
        },
        {
            path: "/symmetries",
            component: () => import("@/components/ShowSymmetries.vue")
        },
        {
            path: "/log",
            component: () => import("@/components/ShowLog.vue")
        },
    ],
});
