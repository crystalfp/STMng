/**
 * Setup channel to return special switches to the client
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-03
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
import type {CtrlParams} from "@/types";
import {ipcMain} from "electron";

/**
 * Setup channel to send special command line switches to client
 */
export const setupChannelSpecialSwitches = (params: CtrlParams): void => {

    ipcMain.handle("SYSTEM:SWITCHES", (): CtrlParams => {

		return params;
	});
};
