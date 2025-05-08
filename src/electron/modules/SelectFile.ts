/**
 * Select a file as requested by the client file selector widget.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-08-22
 */
import {ipcMain, dialog} from "electron";
import type {CtrlParams, FileFilter} from "@/types";

/**
 * Setup the channel to the client
 */
export const setupChannelFileSelector = (): void => {

	ipcMain.handle("SYSTEM:select", (_event, params: CtrlParams) => {

		const kind   = params.kind as string ?? "load";
		const title  = params.title as string ?? "Select file";
		const filter = JSON.parse(params.filter as string ?? "[{name: 'All', extensions: ['*']}]") as FileFilter[];

		if(kind === "load") {
			const file = dialog.showOpenDialogSync({
				title,
				properties: ["openFile"],
				filters: filter,
			});
			if(file) return {
				filename: file[0].replaceAll("\\", "/")
			};
		}
		else {
			const file = dialog.showSaveDialogSync({
				title,
				filters: filter,
			});
			if(file) return {
				filename: file.replaceAll("\\", "/")
			};
		}

		return {filename: ""};
	});
};
