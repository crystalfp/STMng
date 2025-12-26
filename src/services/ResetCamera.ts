/**
 * Reset camera position
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-12-26
 */
import {useControlStore} from "@/stores/controlStore";

const controlStore = useControlStore();

/**
 * Reset camera position
 */
export const resetCamera = (): void => {
    setTimeout(() => {controlStore.reset = true;}, 20);
};
