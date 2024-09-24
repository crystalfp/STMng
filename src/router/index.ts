/**
 * Setup router. Besides main entry, one for each independent window to be created
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {createWebHashHistory, createRouter} from "vue-router";

import LayoutClient from "@/components/LayoutClient.vue";
import ChartViewer from "@/components/ChartViewer.vue";
import ProjectEditor from "@/components/ProjectEditor.vue";
import ShowSymmetries from "@/components/ShowSymmetries.vue";
import ShowLog from "@/components/ShowLog.vue";

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
            component: ChartViewer
        },
        {
            path: "/editor",
            component: ProjectEditor
        },
        {
            path: "/symmetries",
            component: ShowSymmetries
        },
        {
            path: "/log",
            component: ShowLog
        },
    ],
});
