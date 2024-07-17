/**
 * Setup router. Besides main entry, one for each independent window to be created
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import {createWebHashHistory, createRouter} from "vue-router";

import LayoutClient from "../../src/components/LayoutClient.vue";
import ChartViewer from "../../src/components/ChartViewer.vue";
import ProjectEditor from "../../src/components/ProjectEditor.vue";
import ShowSymmetries from "../../src/components/ShowSymmetries.vue";

/** Routes for the external windows created */
export const router = createRouter({
    history: createWebHashHistory(),
    routes: [
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
    ],
});
