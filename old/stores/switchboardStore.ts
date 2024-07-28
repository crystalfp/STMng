/**
 * The shared state of the application. It is accessed through the switchboard.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
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
        /**
         * Clean the switchboard
         */
        clear() {
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			for(const key in this.ui) delete this.ui[key];
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			for(const key in this.data) delete this.data[key];
        },
        /**
         * Initialize the switchboard structures for a given node
         *
         * @param id - ID of the node to be initialized
         */
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
