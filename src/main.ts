/**
 * Entry point for the renderer (client) part of the application
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {createApp, defineAsyncComponent} from "vue";
import log from "electron-log/renderer";
import {createPinia} from "pinia";
import {preloadFonts} from "./services/SpriteText";

// The app
import App from "./App.vue";

// The router plugin
import {router} from "./router";

// Vuetify
import "vuetify/styles";
import {createVuetify} from "vuetify";
import {aliases, mdi} from "vuetify/iconsets/mdi-svg";
import {md2} from "vuetify/blueprints";

// Vuetify components that will be used
import {VSlider} from "vuetify/components/VSlider";
import {VBtn} from "vuetify/components/VBtn";
import {VLabel} from "vuetify/components/VLabel";
import {VList, VListItem, VListItemTitle} from "vuetify/components/VList";
import {VColorPicker} from "vuetify/components/VColorPicker";
import {VExpansionPanel, VExpansionPanels, VExpansionPanelTitle,
		VExpansionPanelText} from "vuetify/components/VExpansionPanel";
import {VMenu} from "vuetify/components/VMenu";
import {VSwitch} from "vuetify/components/VSwitch";
import {VTextField} from "vuetify/components/VTextField";
import {VDialog} from "vuetify/components/VDialog";
import {VCard, VCardText, VCardActions} from "vuetify/components/VCard";
import {VTabs, VTab} from "vuetify/components/VTabs";
import {VApp} from "vuetify/components/VApp";
import {VRow, VContainer, VSpacer, VCol} from "vuetify/components/VGrid";
import {VAlert} from "vuetify/components/VAlert";
import {VDivider} from "vuetify/components/VDivider";
import {VIcon} from "vuetify/components/VIcon";
import {VBtnToggle} from "vuetify/components/VBtnToggle";
import {VSnackbar} from "vuetify/components/VSnackbar";
import {VTable} from "vuetify/components/VTable";
import {VRangeSlider} from "vuetify/components/VRangeSlider";
import {VFileInput} from "vuetify/components/VFileInput";
import {VSelect} from "vuetify/components/VSelect";
import {VNumberInput} from "vuetify/labs/VNumberInput";
import {VTextarea} from "vuetify/components/VTextarea";

// Start catching unhandled exceptions and promises
log.errorHandler.startCatching({showDialog: false});

// Create and mount Vue app
const app = createApp(App)
    .use(router)
    .use(createPinia())
	.use(createVuetify({
		components: {
			VSlider,
			VBtn,
			VLabel,
			VList, VListItem, VListItemTitle,
			VColorPicker,
			VExpansionPanels, VExpansionPanel, VExpansionPanelText, VExpansionPanelTitle,
			VMenu,
			VSwitch,
			VTextField,
			VDialog,
			VCard, VCardText, VCardActions,
			VTabs, VTab,
			VApp,
			VRow, VContainer, VSpacer, VCol,
			VAlert,
			VDivider,
			VIcon,
			VBtnToggle,
			VSnackbar,
			VTable,
			VRangeSlider,
			VFileInput,
			VSelect,
			VNumberInput,
			VTextarea,
		},
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
	.component("GAlignLabels", defineAsyncComponent(() => import("./widgets/AlignLabels.vue")))
	.component("GColorSelector", defineAsyncComponent(() => import("./widgets/ColorSelector.vue")))
	.component("GAtomsSelector", defineAsyncComponent(() => import("./widgets/AtomsSelector.vue")))
	.component("GSliderWithSteppers", defineAsyncComponent(() => import("./widgets/SliderWithSteppers.vue")))
	.component("GDebouncedSlider", defineAsyncComponent(() => import("./widgets/DebouncedSlider.vue")))
	.component("GDebouncedRangeSlider", defineAsyncComponent(() => import("./widgets/DebouncedRangeSlider.vue")))
	.component("GErrorAlert", defineAsyncComponent(() => import("./widgets/ErrorAlert.vue")))
	.component("GSelectFile", defineAsyncComponent(() => import("./widgets/SelectFile.vue")))

	// Directive to focus the element when the bound element is mounted into the DOM
    .directive("focus", {mounted(element: HTMLElement) {element.focus();}});

// Add global error handlers
app.config.errorHandler = (error: unknown): void => {
	log.error(`Unhandled exception: ${(error as Error).message}\n`, (error as Error).stack);
};

addEventListener("unhandledrejection", (event): void => {
	log.error("Unhandled rejection:", event.reason);
});

// Preload fonts for labels
preloadFonts();

// Mount the application
app.mount("#app");
