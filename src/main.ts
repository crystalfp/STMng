/**
 * Entry point for the renderer (client) part of the application
 *
 * @packageDocumentation
 */
import {createApp} from "vue";
import log from "electron-log/renderer";
import {createPinia} from "pinia";
import "@/styles/font-faces.css";

import App from "./App.vue";

// Plugins
import {router} from "@/router";

import MdiSvg from "@yeliulee/vue-mdi-svg/v3";

import VueTippy from "vue-tippy";
import "tippy.js/dist/tippy.css";
import "tippy.js/themes/material.css";
import "tippy.js/animations/scale-extreme.css";

// Vuetify
import "vuetify/styles";
import {createVuetify} from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import {aliases, mdi} from "vuetify/iconsets/mdi-svg";
import {md2} from "vuetify/blueprints";

// Start catching unhandled exceptions and promises
log.errorHandler.startCatching({showDialog: false});

// Create and mount Vue app
const app = createApp(App)
    .use(router)
    .use(createPinia())
	.use(MdiSvg)
	.use(VueTippy, {
		directive: "tooltip",
		defaultProps: {
				theme: "material",
				delay: [900, 150],
				animation: "scale-extreme",
				duration: 150,
				maxWidth: 200,
				appendTo: "parent",
				trigger: "mouseenter",
		}
	})
	.use(createVuetify({
		components,
		directives,
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
    .directive("focus", {
        // When the bound element is mounted into the DOM, focus the element
        mounted(element: HTMLElement) {
            element.focus();
        }
    });

app.mount("#app");
