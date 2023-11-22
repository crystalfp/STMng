/**
 * Setup router. Besides main entry, one for each independent window to be created
 *
 * @packageDocumentation
 */
import {createWebHashHistory, createRouter} from "vue-router";

import LayoutClient from "@/components/LayoutClient.vue";

export const router = createRouter({
    history: createWebHashHistory(),
    routes:  [
        {
            path: "/",
            component: LayoutClient
        },
    ],
});
