/**
 * Select a file as requested by the client file selector widget.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-08-22
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
