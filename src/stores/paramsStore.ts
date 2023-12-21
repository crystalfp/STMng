/**
 * The shared state of the application.
 *
 * @packageDocumentation
 */
import {defineStore, acceptHMRUpdate} from "pinia";
import type {ModulesParams} from "@/types";

export const useParamsStore = defineStore("ParamsStore", {

    state: () => ({
        modules: {}
	} as ModulesParams),
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useParamsStore, import.meta.hot));
}
