/**
 * Messages that flow from computations to the UI.
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
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import {defineStore, acceptHMRUpdate} from "pinia";

/** Level for the alert messages */
export type AlertLevel = "success" | "info" | "warning" | "error";

/**
 * Content of the store
 * @notExported
 */
interface MessageState {
	/** System messages */
	system: {
		/** Message text */
		message: string;
		/** Kind of message */
		level: AlertLevel;
	};

	/** Origin node for the (non-system) message */
	node: string;
	/** Level of the message (normally it is "error") */
	level: AlertLevel;
	/** Text of the message */
	text: string;
}

/** Access the message store that contains messages that flow from computations to the UI */
export const useMessageStore = defineStore("MessageStore", {

    state: () => ({
		system: {message: "", level: "error"},
		node: "",
		level: "error",
		text: ""
	} as MessageState),
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useMessageStore, import.meta.hot));
}
