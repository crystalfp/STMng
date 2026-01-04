/**
 * Setup channel to return special switches to the client
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-03
 */
import type {CtrlParams} from "@/types";
import {ipcMain} from "electron";

/**
 * Setup channel to send special switches to client
 */
export const setupChannelSpecialSwitches = (params: CtrlParams): void => {

    ipcMain.handle("SYSTEM:SWITCHES", (): CtrlParams => {

		return params; // TBD
	});
};
