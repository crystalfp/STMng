/**
 * Setup an handler for Esc press to close a given window
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-09-19
 */
import {onBeforeUnmount, onMounted} from "vue";
import {closeWindow} from "./RoutesClient";

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
