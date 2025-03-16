/**
 * Receive the application theme.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-09-27
 */
import {ref} from "vue";
import {getPreferenceSync, receiveBroadcast} from "@/services/RoutesClient";

/** The loaded theme */
export const theme = ref(getPreferenceSync("Theme", "dark"));

receiveBroadcast((eventType: string, params: (string | boolean)[]) => {
    if(eventType === "theme-change") {
        theme.value = params[0] as string;
    }
});
