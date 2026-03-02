/**
 * Setup an handler for special keys (Esc, F1, F12) on secondary windows
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-09-19
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
import {onBeforeUnmount, onMounted} from "vue";
import {closeWindow, sendToNode} from "./RoutesClient";

/**
 * Parameters to the handleSpecialKeys routine
 * @notExported
 */
interface SpecialKeysOptions {

	/** If true or not present, enable Escape key handling (close window) */
	escape?: boolean;

	/** If true or not present, enable F1 key handling (show window help) */
	f1?: boolean;

	/** If true or not present, enable F12 key handling
	 * (open DevTools on the window on developer mode) */
	f12?: boolean;
}

/**
 * Setup handler for the special keys on a secondary window
 *
 * @param windowPath - Path to the secondary window
 * @param options - Options for the handler
 */
export const handleSpecialKeys = (windowPath: string, options: SpecialKeysOptions = {}): void => {

	const {escape=true, f1=true, f12=true} = options;

	const specialKeysHandler = (event: KeyboardEvent): void => {

		if(event.key === "Escape" && escape) {
			closeWindow(windowPath);
			event.preventDefault();
		}
		else if(event.key === "F1" && f1) {
			// Handle help
			sendToNode("SYSTEM", "secondary-key", {
        		key: "F1",
        		request: windowPath.slice(1)
		    });
			event.preventDefault();
		}
		else if(event.key === "F12" && f12) {
			// Handle devtools
			sendToNode("SYSTEM", "secondary-key", {
        		key: "F12",
        		request: windowPath
		    });
			event.preventDefault();
		}
	};

	onMounted(() => {
		document.addEventListener("keydown", specialKeysHandler);
	});

	onBeforeUnmount(() => {
		document.removeEventListener("keydown", specialKeysHandler);
	});
};
