/**
 * Writer for CIF formatted files
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {openSync, writeSync, closeSync} from "node:fs";
import {reducingToFractionalCoordinates, basisToLengthAngles, format} from "../modules/Helpers";
import {getCellVolume} from "../fingerprint/Helpers";
import type {Structure, WriterImplementation, CtrlParams} from "@/types";

export class WriterCIF implements WriterImplementation {

	writeStructure(filename: string, structures: Structure[]): CtrlParams {

		try {
			const fd = openSync(filename, "w");

			// Banner
			writeSync(fd, "####################### " +
						  "Written by STMng " +
						  "#######################\n\n");

			let step = 0;
			const numberSteps = structures.length;
			for(const structure of structures) {

				// Access the structure
				const {crystal} = structure;
				const {basis, spaceGroup} = crystal;

				// Start data block
				writeSync(fd, numberSteps === 1 ? "data_structure\n\n" : `data_step_${step}\n\n`);

				// Output the unit cell, if any
				if(basis.some((value: number) => value !== 0)) {

					const cell = basisToLengthAngles(basis);
					const volume = getCellVolume(basis);

        			writeSync(fd, `_cell_length_a    ${cell[0].toFixed(6)}\n`);
        			writeSync(fd, `_cell_length_b    ${cell[1].toFixed(6)}\n`);
        			writeSync(fd, `_cell_length_c    ${cell[2].toFixed(6)}\n`);
        			writeSync(fd, `_cell_angle_alpha ${cell[3].toFixed(6)}\n`);
        			writeSync(fd, `_cell_angle_beta  ${cell[4].toFixed(6)}\n`);
        			writeSync(fd, `_cell_angle_gamma ${cell[5].toFixed(6)}\n`);
        			writeSync(fd, `_cell_volume      ${volume.toFixed(6)}\n`);
				}

				// The space group if any
				if(spaceGroup !== "") {

					if(spaceGroup.startsWith("(")) {

						// Ignore lattice type
						const pos = spaceGroup.indexOf(")");
						writeSync(fd, "\nloop_\n_symmetry_equiv_pos_as_xyz\n");
						const symms = spaceGroup.slice(pos+1).split("\n");
						for(const symm of symms) writeSync(fd, `'${symm}'\n`);
					}
					else if("PpCcIiFfAa".includes(spaceGroup.at(0)!)) {
						writeSync(fd, `\n_symmetry_space_group_name_H-M '${spaceGroup}'\n`);
					}
					else {
						writeSync(fd, "\nloop_\n_symmetry_equiv_pos_as_xyz\n");
						const symms = spaceGroup.split("\n");
						for(const symm of symms) writeSync(fd, `'${symm}'\n`);
					}
				}

				// The atom coordinates
				writeSync(fd, "\nloop_\n" +
							  "_atom_site_type_symbol\n" +
							  "_atom_site_label\n" +
							  "_atom_site_occupancy\n" +
							  "_atom_site_fract_x\n" +
							  "_atom_site_fract_y\n" +
							  "_atom_site_fract_z\n");

				// Compute fractional coordinates removing duplicates
				const reduced = reducingToFractionalCoordinates(structure);

				for(const atom of reduced.atoms) {

					const fc = atom.frac;
					writeSync(fd, `${atom.symbol.padEnd(4)} ${atom.label.padEnd(7)} 1.0 ` +
								  `${format(fc[0])} ${format(fc[1])} ${format(fc[2])}\n`);
				}

				++step;
			}
			closeSync(fd);

			return {payload: "Success!"};
		}
		catch(error) {
			return {error: (error as Error).message};
		}
	}
}
