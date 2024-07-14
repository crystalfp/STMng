/**
 * Entry point for the renderer (client) part of the application
 *
 * @packageDocumentation
 */
import {createApp, defineAsyncComponent} from "vue";
import log from "electron-log/renderer";
import {createPinia} from "pinia";

// The app
import App from "./App.vue";

// Plugins
import {router} from "@/router";

// Vuetify
import "vuetify/styles";
import {createVuetify} from "vuetify";
import {aliases, mdi} from "vuetify/iconsets/mdi-svg";
import {md2} from "vuetify/blueprints";

// Start catching unhandled exceptions and promises
log.errorHandler.startCatching({showDialog: false});

// Create and mount Vue app
const app = createApp(App)
    .use(router)
    .use(createPinia())
	.use(createVuetify({
		theme: {
    		defaultTheme: "dark",
  		},
		icons: {
			defaultSet: "mdi",
			aliases,
			sets: {
				mdi,
			},
  		},
		blueprint: md2,
		defaults: {
			global: {
				density: "compact"
			},
			VBtn: {
      			density: "default",
    		},
		}
  	}))

	// Project defined components. The registered name should begin by G (g- in templates)
	.component("GAlignLabels", defineAsyncComponent(() => import("@/widgets/AlignLabels.vue")))
	.component("GColorSelector", defineAsyncComponent(() => import("@/widgets/ColorSelector.vue")))
	.component("GAtomsSelector", defineAsyncComponent(() => import("@/widgets/AtomsSelector.vue")))
	.component("GSliderWithSteppers", defineAsyncComponent(() => import("@/widgets/SliderWithSteppers.vue")))
	.component("GDebouncedSlider", defineAsyncComponent(() => import("@/widgets/DebouncedSlider.vue")))
	.component("GDebouncedRangeSlider", defineAsyncComponent(() => import("@/widgets/DebouncedRangeSlider.vue")));

// Add global error handler
app.config.errorHandler = (error: unknown) => {
	log.error("Global error handler:", (error as Error).message);
};

// Mount the application
app.mount("#app");
