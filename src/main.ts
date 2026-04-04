/**
 * Entry point for the renderer (client) part of the application
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {createApp, nextTick} from "vue";
import log from "electron-log/renderer";
import {createPinia} from "pinia";
import {preloadFonts} from "./services/SpriteText";

// The app
import App from "./App.vue";

// The router plugin
import {router} from "./router";

// The global styles
import "@/styles/common.css";

// Vuetify
import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import {createVuetify} from "vuetify";
import {aliases, mdi} from "vuetify/iconsets/mdi";
import {md3} from "vuetify/blueprints";

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
import {VTable} from "vuetify/components/VTable";
import {VRangeSlider} from "vuetify/components/VRangeSlider";
import {VFileInput} from "vuetify/components/VFileInput";
import {VSelect} from "vuetify/components/VSelect";
import {VNumberInput} from "vuetify/components/VNumberInput";
import {VTextarea} from "vuetify/components/VTextarea";
// import {VTooltip} from "vuetify/components/VTooltip";
// import {Tooltip} from "vuetify/directives/tooltip";
import {Ripple} from "vuetify/directives/ripple";
import {VSnackbarQueue} from "vuetify/components/VSnackbarQueue";
import {VAutocomplete} from "vuetify/components/VAutocomplete";
import {VDataTable} from "vuetify/components/VDataTable";

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
			VTable,
			VRangeSlider,
			VFileInput,
			VSelect,
			VNumberInput,
			VTextarea,
			// VTooltip,
			VSnackbarQueue,
			VAutocomplete,
			VDataTable
		},
		directives: {
			// Tooltip,
			Ripple
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
		blueprint: md3,
		defaults: {
			global: {
				density: "compact"
			},
			VBtn: {
      			density: "default",
				variant: "outlined",
				style: "text-transform: uppercase;letter-spacing: 0.3px;"
    		},
			VSwitch: {
				density: "compact",
				color: "primary",
				hideDetails: true
			},
			VBtnToggle: {
				density: "comfortable",
				color: "primary",
				variant: "outlined",
				divided: true,
				rounded: "xl"
			},
			VSelect: {
				variant: "filled",
				hideDetails: true
			},
			VNumberInput: {
				variant: "filled",
				controlVariant: "stacked",
				density: "compact"
			},
			VTextField: {
				variant: "filled",
			},
			VRangeSlider: {
				color: "primary"
			},
			VAutocomplete: {
				variant: "filled",
			},
		}
  	}))

	// Directive to focus the element when the bound element is mounted into the DOM
    .directive("focus", {
  		mounted(element: HTMLElement) {
    		// Use nextTick to ensure DOM is ready
    		void nextTick(() => {element.focus();});
		}
	});

// Add global error handlers
app.config.errorHandler = (error: unknown, instance: unknown, info: string) => {

	const e = error as Error;

	log.error(`%cUnhandled exception: %c${e.message}\n`,
			  "color: red", "color: unset",
			  `In component ${JSON.stringify(instance)}\n`,
			  `Error info: ${info}\n`,
			   e.stack);
};

addEventListener("unhandledrejection", (event: PromiseRejectionEvent): void => {
	if(event.reason) log.error("%cUnhandled rejection:", "color: red", event.reason);
});

// Preload fonts for labels
preloadFonts();

// Mount (and start) the application when the route is ready (needed for secondary windows)
router.isReady()
	.then(() => {
		app.mount("#app");
  	})
  	.catch((error: Error) => {
		log.error(`Cannot mount application. Error: ${error.message}`);
	});
