/**
 * Interfaces to the channels to the main process.
 *
 * @packageDocumentation
 */
import type {ElectronAPI} from "@electron-toolkit/preload";
// import type {IpcRendererEvent} from "electron";
// import type {ProjectOnScreen, TagValue, MainResponse, DocumentFull, DocumentMetadata,
// 			 DocumentReferenceWithTitle, UUID, FragmentContext, QueryResultsBlock, Languages} from "@/types";
// import type {WindowsParams} from "@/electron/types";

/** Global definitions of the interfaces exported by preload.js */
declare global {
	interface Window {
		electron: ElectronAPI;
		api: {
			setTitle: (title: string) => void;
			refreshMenu: () => void;
		};
	}
}


// > Main window handling
/**
 * Set main window title
 *
 * @param title - The title to set on the main window
 */
export const setTitle = (title: string): void => window.api.setTitle(title);
