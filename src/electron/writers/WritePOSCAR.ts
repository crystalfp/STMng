/**
 * Writer for POSCAR formatted files
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import {openSync, closeSync} from "node:fs";
import {writeSectionPOSCAR} from "./sectionPOSCAR";
import {hasNoUnitCell} from "../modules/Helpers";
import type {Structure, WriterImplementation, CtrlParams} from "@/types";

export class WriterPOSCAR implements WriterImplementation {

	writeStructure(filename: string, structures: Structure[]): CtrlParams {

		try {
			const fd = openSync(filename, "w");
			for(const structure of structures) {

				// Access the structure
				const {crystal, atoms, extra} = structure;

				// Step label
				const step = (extra.step === undefined) ? "" : ` (step: ${extra.step})`;

				// Extra sanity check
				if(!crystal || atoms.length === 0) {
					closeSync(fd);
					return {payload: "Error",
							error: `Cannot write POSCAR if structure is malformed${step}`};
				}

				// If no unit cell return error
				const {basis} = crystal;
				if(hasNoUnitCell(basis)) {
					closeSync(fd);
					return {payload: "Error",
							error: `Cannot write POSCAR if unit cell missing${step}`};
				}

				// Write the POSCAR formatted structure
				writeSectionPOSCAR(fd, step, structure);
			}
			closeSync(fd);

			return {payload: "Success!"};
		}
		catch(error) {
			return {payload: "Error", error: (error as Error).message};
		}
	}
}
