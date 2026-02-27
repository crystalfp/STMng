/**
 * Reader for CIF formatted files
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
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import {createReadStream} from "node:fs";
import {createInterface} from "node:readline/promises";
import {extractBasis, fractionalToCartesianCoordinates, hasNoUnitCell} from "../modules/Helpers";
import {getAtomicNumber} from "../modules/AtomData";
import {EmptyStructure} from "../modules/EmptyStructure";
import type {Structure, Atom, ReaderImplementation} from "@/types";
import {ParseQuotedLine} from "../modules/ParseQuotedLine";

/** Collect lines from "loop_" constructs */
class Table {

	private readonly headers: string[] = [];
	private readonly rows: string[][] = [];
	private incompleteLine: string | undefined = undefined;
	private readonly splitter = new ParseQuotedLine();

	/**
	 * Begin capturing a table
	 */
	startTable(): void {
		this.headers.length = 0;
		this.rows.length = 0;
		this.incompleteLine = undefined;
	}

	/**
	 * Add a new table header.
	 * The key is normalized converting "." to "_"
	 *
	 * @param header - The key listed in the loop_ construct
	 */
	addColumn(header: string): void {
		this.headers.push(header.replaceAll(".", "_"));
	}

	/**
	 * Add a new row to the table
	 *
	 * @param line - Line to be parsed and loaded
	 */
	addRow(line: string): void {

		if(this.incompleteLine) {
			line = `${this.incompleteLine} ${line}`;
			this.incompleteLine = undefined;
		}
		const fields = this.splitter.split(line);
		if(fields.length < this.headers.length) this.incompleteLine = line;
		else this.rows.push(fields);
	}

	/**
	 * Check if a column exists.
	 * The key is normalized converting "." to "_"
	 *
	 * @param header - Key of a column of the table
	 * @returns True if the column is present in the table
	 */
	hasColumn(header: string): boolean {
		return this.headers.includes(header.replaceAll(".", "_"));
	}

	/**
	 * Extract a table column.
	 * The key is normalized converting "." to "_"
	 *
	 * @param header - Column to be extracted
	 * @returns The column as array of strings. If the column does not exist return empty array.
	 */
	getColumn(header: string): string[] {
		const idx = this.headers.indexOf(header.replaceAll(".", "_"));
		if(idx === -1) return [];
		const result = [];
		for(const row of this.rows) result.push(row[idx]);
		return result;
	}

	/**
	 * Extract a table column.
	 * The key is normalized converting "." to "_"
	 *
	 * @param header - Column to be extracted
	 * @returns The column as array of strings. If the column does not exist return empty array.
	 */
	getColumns(header: string): string[][] {
		const idx = this.headers.indexOf(header.replaceAll(".", "_"));
		if(idx === -1) return [];
		const result = [];
		for(const row of this.rows) result.push(row);
		return result;
	}

	/**
	 * Dump the table for debugging
	 */
	// dump(): void {
	// 	console.log("=====");
	// 	console.log(this.headers.join(";"));
	// 	console.log("-----");
	// 	for(const row of this.rows) console.log(row.join(";"));
	// }
}

export class ReaderCIF implements ReaderImplementation {

	private readonly tbl = new Table();
	private readonly structures: Structure[] = [];
	private step = -1;

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @returns The set of structures read
	 */
	async readStructure(filename: string): Promise<Structure[]> {

		let isInDataBlock = false;
		let basisSides  = [0, 0, 0];
		let basisAngles = [0, 0, 0];
		let isInLoop = false;
		let isInLoopHeader = false;

		// Read file by line
		const reader = createInterface(createReadStream(filename, {encoding: "utf8"}));
		for await (const line of reader) {

			// Clear line from comments and control characters
			const lineNC = line.replace(/#.*/, "").trim();
			if(lineNC === "") continue;
			// eslint-disable-next-line no-control-regex
			if(/[\u0000-\u0008\u000E-\u001F]/.test(lineNC)) continue;

			// The keys are case insensitive
			const lineLC = lineNC.toLowerCase();

			// Capture table
			if(isInLoop) {
				if(lineLC.startsWith("loop_") || lineLC.startsWith("data_")) {
					isInLoop = false;
					isInLoopHeader = false;
					this.useTable();
				}
				else if(lineLC.startsWith("_")) {
					if(isInLoopHeader) {
						this.tbl.addColumn(lineLC);
						continue;
					}
					else {
						isInLoop = false;
						isInLoopHeader = false;
						this.useTable();
					}
				}
				else {
					isInLoopHeader = false;
					this.tbl.addRow(lineNC);
				}
			}

			// Start data block or loop block
			if(lineLC.startsWith("data_")) {

				isInDataBlock = true;

				// Check last block valid
				if(this.step < 0 || this.structures[this.step].atoms.length > 0) {
					++this.step;
					this.structures.push(new EmptyStructure());
					this.structures[this.step].extra.step = this.step+1;
				}
				basisSides  = [0, 0, 0];
				basisAngles = [0, 0, 0];
				continue;
			}
			else if(lineLC.startsWith("loop_")) {

				// Everything before a data block is ignored
				if(!isInDataBlock) continue;

				isInLoop = true;
				isInLoopHeader = true;
				this.tbl.startTable();
				continue;
			}

			// Everything before a data block is ignored
			if(!isInDataBlock) continue;

			// Extract key and value inline
			const ws = lineLC.split(/\s+/);

			switch(ws[0]) {
				case "_symmetry.space_group_name_h-m":
				case "_symmetry_space_group_name_h-m":
				case "_space_group_name_h-m_alt":
				case "_space_group_name_h-m":
					this.structures[this.step].crystal.spaceGroup =
						lineNC
							.split(/\s+/)
							.slice(1)
							.join(" ")
							.replace(/^["']([^"']+)["']/, "$1")
							.trim();
					break;
				case "_cell_length_a":
				case "_cell.length_a":
					basisSides[0] = Number.parseFloat(ws[1] ?? "0");
					break;
				case "_cell_length_b":
				case "_cell.length_b":
					basisSides[1] = Number.parseFloat(ws[1] ?? "0");
					break;
				case "_cell_length_c":
				case "_cell.length_c":
					basisSides[2] = Number.parseFloat(ws[1] ?? "0");
					if(basisSides[0] !== 0 && basisSides[1] !== 0 && basisSides[2] !== 0 &&
					   basisAngles[0] !== 0 && basisAngles[1] !== 0 && basisAngles[2] !== 0) {
						this.structures[this.step].crystal.basis =
								extractBasis(basisSides[0],  basisSides[1],  basisSides[2],
											 basisAngles[0], basisAngles[1], basisAngles[2]);
					}
					break;
				case "_cell_angle_alpha":
				case "_cell.angle_alpha":
					basisAngles[0] = Number.parseFloat(ws[1] ?? "0");
					break;
				case "_cell_angle_beta":
				case "_cell.angle_beta":
					basisAngles[1] = Number.parseFloat(ws[1] ?? "0");
					break;
				case "_cell_angle_gamma":
				case "_cell.angle_gamma":
					basisAngles[2] = Number.parseFloat(ws[1] ?? "0");
					if(basisSides[0] !== 0 && basisSides[1] !== 0 && basisSides[2] !== 0 &&
					   basisAngles[0] !== 0 && basisAngles[1] !== 0 && basisAngles[2] !== 0) {
						this.structures[this.step].crystal.basis =
								extractBasis(basisSides[0],  basisSides[1],  basisSides[2],
											 basisAngles[0], basisAngles[1], basisAngles[2]);
					}
					break;
			}
		}

		// Close a table at the end of the file
		if(isInLoop) this.useTable();

		// The file should have a data_<block_name> line
		if(!isInDataBlock) throw Error("Missing data_ line in file");

		// Build the structure
		for(const structure of this.structures) {
			structure.bonds = [];
		}

		return this.structures;
	}

	/**
	 * Use the values of a table to fill the structures
	 */
	private useTable(): void {

		// this.tbl.dump();
		if(this.tbl.hasColumn("_atom_site_fract_x")) {

			const {basis} = this.structures[this.step].crystal;
			if(hasNoUnitCell(basis)) throw Error("Invalid unit cell parameters");

			const fracX  = this.tbl.getColumn("_atom_site_fract_x");
			const fracY  = this.tbl.getColumn("_atom_site_fract_y");
			const fracZ  = this.tbl.getColumn("_atom_site_fract_z");
			const label  = this.tbl.getColumn("_atom_site_label");
			const chain  = this.tbl.getColumn("_atom_site_label_asym_id");
			const symbol = this.tbl.getColumn("_atom_site_type_symbol");
			const hasSymbol = symbol.length > 0;
			const hasChain = chain.length > 0;
			const hasLabel = label.length > 0;

			const natoms = fracX.length;
			for(let i=0; i < natoms; ++i) {
				const fx = Number.parseFloat(fracX[i]);
				const fy = Number.parseFloat(fracY[i]);
				const fz = Number.parseFloat(fracZ[i]);
				const az = (hasSymbol ? symbol[i] : label[i]).replaceAll(/[^a-z]/gi, "");
				const atom: Atom = {
					atomZ: getAtomicNumber(az),
					label: hasLabel ? label[i] : symbol[i],
					chain: hasChain ? chain[i] : "",
					position: fractionalToCartesianCoordinates(basis, fx, fy, fz)
				};
				this.structures[this.step].atoms.push(atom);
			}

			this.pruneByOccupancy();
		}
		else if(this.tbl.hasColumn("_symmetry_equiv_pos_as_xyz")) {

			this.structures[this.step].crystal.spaceGroup =
				this.getEquivalent(this.tbl.getColumns("_symmetry_equiv_pos_as_xyz"));
		}
		else if(this.tbl.hasColumn("_atom_site_cartn_x")) {

			const cartnX   = this.tbl.getColumn("_atom_site_cartn_x");
			const cartnY   = this.tbl.getColumn("_atom_site_cartn_y");
			const cartnZ   = this.tbl.getColumn("_atom_site_cartn_z");
			const label    = this.tbl.getColumn("_atom_site_label_atom_id");
			const chain    = this.tbl.getColumn("_atom_site_label_asym_id");
			const atomType = this.tbl.getColumn("_atom_site_type_symbol");
			const hasAtomType = atomType.length > 0;
			const hasChain = chain.length > 0;
			const natoms = cartnX.length;
			for(let i=0; i < natoms; ++i) {
				const x = Number.parseFloat(cartnX[i]);
				const y = Number.parseFloat(cartnY[i]);
				const z = Number.parseFloat(cartnZ[i]);
				const symbol = (hasAtomType ? atomType[i] : label[i]).replaceAll(/[^a-z]/gi, "");
				const atom: Atom = {
					atomZ: getAtomicNumber(symbol),
					label: label[i],
					chain: hasChain ? chain[i] : "",
					position: [x, y, z]
				};
				this.structures[this.step].atoms.push(atom);
			}

			this.pruneByOccupancy();
		}
		else if(this.tbl.hasColumn("_space_group_symop_operation_xyz")) {

			this.structures[this.step].crystal.spaceGroup =
				this.getEquivalent(this.tbl.getColumns("_space_group_symop_operation_xyz"));
		}
	}

	/**
	 * Workaround to format the equivalent positions list.
	 * Sometimes is coded as
	 *
```
	   loop_
		_symmetry_equiv_pos_as_xyz
		1 x,y,z
		2 -x,y,-z
```
	 * Instead of
```
		loop_
			_symmetry_equiv_pos_site_id
			_symmetry_equiv_pos_as_xyz
			1  'x, y, z'
			2  '-x, -y, -z'
```
	 *
	 * @param symop - List of lines in the equivalent positions
	 * @returns The string to be put in the spaceGroup field
	 */
	private getEquivalent(symop: string[][]): string {

		if(symop.length === 0) return "";

		let out = "";
		let next = false;
		for(const line of symop) {

			if(next) out += "\n";
			else next = true;

			out += line.length > 1 ? line[1] : line[0];
		}

		return out;
	}

	/**
	 * Remove coincident atoms based on their occupancy
	 */
	private pruneByOccupancy(): void {

		// To prune need occupancy values
		const siteOccupancy = this.tbl.getColumn("_atom_site_occupancy");
		const len = siteOccupancy.length;
		if(len === 0) return;

		// And not all sites with full occupancy
		const occupancy = Array<number>(len).fill(1);
		let fullOccupancy = true;
		for(let i=0; i < len; ++i) {
			occupancy[i] = Number.parseFloat(siteOccupancy[i]);
			if(occupancy[i] < 1) fullOccupancy = false;
		}
		if(fullOccupancy) return;

		// And coincident atoms
		const TOL = 1e-6;
		const natoms = siteOccupancy.length;
		const atoms = this.structures[this.step].atoms;
		const atomsToRemove = new Set<number>();

		for(let i=0; i < natoms-1; ++i) {
			const [ix, iy, iz] = atoms[i].position;

			for(let j=i+1; j < natoms; ++j) {
				const [jx, jy, jz] = atoms[j].position;

				if(Math.abs(ix-jx) < TOL &&
				   Math.abs(iy-jy) < TOL &&
				   Math.abs(iz-jz) < TOL) {
					atomsToRemove.add(occupancy[i] > occupancy[j] ? j : i);
				}
			}
		}

		// Remove found atoms starting with the highest index
		if(atomsToRemove.size > 0) {
			const remove = [...atomsToRemove].toSorted((a, b) => b-a);
			for(const idx of remove) {
				atoms.splice(idx, 1);
			}
		}
	}
}
