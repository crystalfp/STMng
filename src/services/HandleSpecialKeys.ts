/**
 * Setup an handler for Esc press to close a given window
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-09-19
 */
import {onBeforeUnmount, onMounted} from "vue";
import {closeWindow, sendToNode} from "./RoutesClient";

/**
 * Setup handler for the Escape key to close a secondary window
 *
 * @param windowRouterPath - Router path for the window to be closed
 */
export const closeWithEscape = (windowRouterPath: string): void => {

	const escapeHandler = (event: KeyboardEvent): void => {
		if(event.key === "Escape") {
			closeWindow(windowRouterPath);
			event.preventDefault();
			document.removeEventListener("keydown", escapeHandler);
		}
	};

	onMounted(() => {
		document.addEventListener("keydown", escapeHandler);
	});

	onBeforeUnmount(() => {
		document.removeEventListener("keydown", escapeHandler);
	});
};

/**
 * Parameters to the handleSpecialKeys routine
 * @notExported
 */
interface SpecialKeysOptions {

	/** Path to the secondary window */
	path: string;

	/** If true or not present, enable Escape key handling (close window) */
	escape?: boolean;

	/** If true or not present, enable F1 key handling (show window help) */
	f1?: boolean;

	/** If true or not present, enable F12 key handling (open DevTools on the window) */
	f12?: boolean;
}

/**
 * Setup handler for the special keys on a secondary window
 *
 * @param options - Options for the handler
 */
export const handleSpecialKeys = (options: SpecialKeysOptions): void => {

	const escape = options.escape ?? true;
	const f1 = options.f1 ?? true;
	const f12 = options.f12 ?? true;

	const specialKeysHandler = (event: KeyboardEvent): void => {

		if(event.key === "Escape" && escape) {
			closeWindow(options.path);
		}
		else if(event.key === "F1" && f1) {
			// Handle help
			sendToNode("SYSTEM", "secondary-key", {
        		key: "F1",
        		request: options.path.slice(1)
		    });
		}
		else if(event.key === "F12" && f12) {
			// Handle devtools
			sendToNode("SYSTEM", "secondary-key", {
        		key: "F12",
        		request: options.path
		    });
		}
		event.preventDefault();
	};

	onMounted(() => {
		document.addEventListener("keydown", specialKeysHandler);
	});

	onBeforeUnmount(() => {
		document.removeEventListener("keydown", specialKeysHandler);
	});
};
