/**
 * Assemble main window title parts
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-12-23
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
import {setTitle} from "./RoutesClient";

/** The various title parts */
const titleParts = {
	/** The application name */
	base: "",
	/** The loaded project */
	project: "",
	/** The loaded structure file */
	file: "",
	/** If the unit cell has been standardized */
	standardized: false
};

/**
 * Assemble the title string from its various parts
 *
 * @returns The assembled title string
 */
const combineParts = (): string => {
	let out = titleParts.base;
	if(titleParts.project) out += "\u2003—\u2003" + titleParts.project;
	if(titleParts.file) {
		out += "\u2003—\u2003" + titleParts.file;
		if(titleParts.standardized) out += " (standardized)";
	}
	return out;
};

/**
 * Save the base title
 *
 * @param baseTitle - Application base title
 */
export const setBaseTitle = (baseTitle: string): void => {

	titleParts.base = baseTitle;
};

/**
 * Set current loaded project in title
 *
 * @param project - Current loaded project or empty string if default project
 */
export const setProjectInTitle = (project: string): void => {

	titleParts.project = project || "default project";
	titleParts.file = "";
	setTitle(combineParts());
};

/**
 * Set currently loaded structure file in title
 *
 * @param filename - Current loaded structure file
 */
export const setFileInTitle = (filename: string): void => {

	titleParts.file = filename;
	setTitle(combineParts());
};

/**
 * Mark file as having the cell standardized
 *
 * @param standardized - If the unit cell has been standardized
 */
export const setStandardizedInTitle = (standardized: boolean): void => {

	titleParts.standardized = standardized;
	setTitle(combineParts());
};
