/**
 * The shared state of the application. It is accessed through the switchboard
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

    // > Actions
    actions: {
        clear() {
			for(const key in this.ui) delete this.ui[key];
			for(const key in this.data) delete this.data[key];
        },
        initNode(id: string) {
            this.ui[id] = {};
            this.data[id] = {};
        }
    }
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useSwitchboardStore, import.meta.hot));
}
