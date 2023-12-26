/**
 * The shared state of the application.
 *
 * @packageDocumentation
 */
import {defineStore, acceptHMRUpdate} from "pinia";

type UiParams = Record<string, string | number | boolean>;

interface SwitchboardState {
    ui: Record<string, UiParams>;
    data: Record<string, unknown>;
}

export const useSwitchboardStore = defineStore("SwitchboardStore", {

    state: () => ({
        ui: {},
        data: {}
	} as SwitchboardState),
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useSwitchboardStore, import.meta.hot));
}
