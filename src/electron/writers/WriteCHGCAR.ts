/**
 * Writer for CHGCAR formatted files
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
import {openSync, writeSync, closeSync} from "node:fs";
import {hasNoUnitCell} from "../modules/Helpers";
import {writeSectionPOSCAR} from "./sectionPOSCAR";
import type {Structure, WriterImplementation, CtrlParams} from "@/types";

export class WriterCHGCAR implements WriterImplementation {

	writeStructure(filename: string, structures: Structure[]): CtrlParams {

		try {
			const fd = openSync(filename, "w");
			for(const structure of structures) {

				// Access the structure
				const {crystal, volume, extra} = structure;
				const {basis} = crystal;

				// Step label
				const step = (extra.step === undefined) ? "" : ` (step: ${extra.step})`;

				// If no unit cell return error
				if(hasNoUnitCell(basis)) {
					closeSync(fd);
					return {error: `Cannot write CHGCAR if unit cell missing${step}`};
				}

				// Write the POSCAR formatted structure
				writeSectionPOSCAR(fd, step, structure);

				// Write values (10 values per line)
				if(volume.length === 0) continue;
				writeSync(fd, "\n");
				for(const set of volume) {
					const {values, sides} = set;
					writeSync(fd, ` ${sides[0]} ${sides[1]} ${sides[2]}`);
					const len = values.length;
					let valuesLine = "";
					for(let i=0; i < len; ++i) {
						if(i % 10 === 0) {
							writeSync(fd, `${valuesLine}\n`);
							valuesLine = "";
						}
						valuesLine += values[i].toExponential(5).padStart(12);
					}
					if(valuesLine !== "") writeSync(fd, `${valuesLine}\n`);
				}
			}
			closeSync(fd);

			return {payload: "Success!"};
		}
		catch(error) {
			return {error: (error as Error).message};
		}
	}
}
