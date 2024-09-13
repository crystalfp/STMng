/**
 * Writer for CIF formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import fs from "node:fs";
import {getAtomicSymbol} from "../modules/AtomData";
import {cartesianToFractionalCoordinates, basisToLengthAngles, format} from "../modules/Helpers";
import type {Structure, WriterImplementation, CtrlParams} from "../../types";

export class WriterCIF implements WriterImplementation {

	writeStructure(filename: string, structures: Structure[]): CtrlParams {

		try {
			const fd = fs.openSync(filename, "w");

			// Banner
			fs.writeSync(fd, "####################### " +
							 "Written by STMng " +
							 "#######################\n\n");

			let step = 0;
			const numberSteps = structures.length;
			for(const structure of structures) {

				// Access the structure
				const {crystal, atoms} = structure;
				const {basis, spaceGroup} = crystal;

				// Start data block
				fs.writeSync(fd, numberSteps === 1 ? "data_structure\n\n" : `data_step_${step}\n\n`);

				// Output the unit cell, if any
				if(basis.some((value: number) => value !== 0)) {

					const cell = basisToLengthAngles(basis);

        			fs.writeSync(fd, `_cell_length_a ${cell[0].toFixed(6)}\n`);
        			fs.writeSync(fd, `_cell_length_b ${cell[1].toFixed(6)}\n`);
        			fs.writeSync(fd, `_cell_length_c ${cell[2].toFixed(6)}\n`);
        			fs.writeSync(fd, `_cell_angle_alpha ${cell[3].toFixed(6)}\n`);
        			fs.writeSync(fd, `_cell_angle_beta  ${cell[4].toFixed(6)}\n`);
        			fs.writeSync(fd, `_cell_angle_gamma ${cell[5].toFixed(6)}\n`);
				}

				// The space group if any
				if(spaceGroup !== "") {

					if(spaceGroup.startsWith("(")) {

						const pos = spaceGroup.indexOf(")");
						// Ignore lattice type

						fs.writeSync(fd, "\nloop_\n_symmetry_equiv_pos_as_xyz\n");
						const symms = spaceGroup.slice(pos+1).split("\n");
						for(const symm of symms) fs.writeSync(fd, `'${symm}'\n`);
					}
					else if("PpCcIiFfAa".includes(spaceGroup.at(0)!)) {
						fs.writeSync(fd, `\n_symmetry_space_group_name_H-M '${spaceGroup}'\n`);
					}
					else {
						fs.writeSync(fd, "\nloop_\n_symmetry_equiv_pos_as_xyz\n");
						const symms = spaceGroup.split("\n");
						for(const symm of symms) fs.writeSync(fd, `'${symm}'\n`);
					}
				}

				// The atom coordinates
				fs.writeSync(fd, "\nloop_\n" +
								 "_atom_site_type_symbol\n" +
								 "_atom_site_label\n" +
								 "_atom_site_fract_x\n" +
								 "_atom_site_fract_y\n" +
								 "_atom_site_fract_z\n");

				const fc = cartesianToFractionalCoordinates(structure);
				let idx = 0;
				for(const atom of atoms) {
					const name = getAtomicSymbol(atom.atomZ);
					fs.writeSync(fd, `${name.padEnd(4)} ${atom.label.padEnd(4)} ` +
									 `${format(fc[idx])} ${format(fc[idx+1])} ` +
									 `${format(fc[idx+2])}\n`);
					idx += 3;
				}

				++step;
			}
			fs.closeSync(fd);

			return {payload: "Success!"};
		}
		catch(error) {
			return {error: (error as Error).message};
		}
	}
}
