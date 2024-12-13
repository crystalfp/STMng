/**
 * Reader for CIF formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {createReadStream} from "node:fs";
import {createInterface} from "node:readline/promises";
import {extractBasis, fractionalToCartesianCoordinates, hasNoUnitCell} from "../modules/Helpers";
import {getAtomicNumber} from "../modules/AtomData";
import {EmptyStructure} from "../modules/EmptyStructure";
import type {Structure, Atom, ReaderImplementation} from "@/types";

/** Collect lines from "loop_" constructs */
class Table {

	private readonly headers: string[] = [];
	private readonly rows: string[][] = [];
	private incompleteLine: string | undefined = undefined;

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
	addColumn(header: string):void {
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
		const fields = this.split(line);
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
	 * @returns The column as array of strings. If the colum does not exist return empty array.
	 */
	getColumn(header: string): string[] {
		const idx = this.headers.indexOf(header.replaceAll(".", "_"));
		if(idx === -1) return [];
		const result = [];
		for(const row of this.rows) result.push(row[idx]);
		return result;
	}

	/**
	 * Split a line honoring the field quoting
	 *
	 * @param line - Line to be split
	 * @returns The tokens from the given string
	 */
	private split(line: string): string[] {

		let result: string[] = [];
		line = line.replaceAll(/['"]/g, "|").replaceAll(String.raw`\|`, "'");
		const special = line.split("|");

		let odd = true;
		for(const w1 of special) {

			if(w1 !== "") result = odd ? [...result, ...w1.trim().split(/\s+/)] : [...result, w1];
			odd = !odd;
		}
		return result;
	}

	/**
	 * Dump the table for debug
	 */
	dump(): void {
		console.log("=====");
		console.log(this.headers.join(";"));
		console.log("-----");
		for(const row of this.rows) console.log(row.join(";"));
	}
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
			// eslint-disable-next-line sonarjs/no-control-regex, no-control-regex
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
				}
				basisSides  = [0, 0, 0];
				basisAngles = [0, 0, 0];
				continue;
			}
			else if(lineLC.startsWith("loop_")) {
				isInLoop = true;
				isInLoopHeader = true;
				this.tbl.startTable();
				continue;
			}

			// Everything before a data block is ignored
			if(!isInDataBlock) continue;

			// Extract key and value inline
			const ws = lineLC.split(/\s+/);
			const key = ws[0];
			const value = ws[1] ?? "";

			switch(key) {
				case "_symmetry.space_group_name_h-m":
				case "_symmetry_space_group_name_h-m":
					this.structures[this.step].crystal.spaceGroup =
						value.replace(/^['"]([^'"]+)['"]/, "$1");
					break;
				case "_cell_length_a":
				case "_cell.length_a":
					basisSides[0] = Number.parseFloat(value);
					break;
				case "_cell_length_b":
				case "_cell.length_b":
					basisSides[1] = Number.parseFloat(value);
					break;
				case "_cell_length_c":
				case "_cell.length_c":
					basisSides[2] = Number.parseFloat(value);
					if(basisAngles[0] !== 0 && basisAngles[1] !== 0 && basisAngles[2] !== 0) {
					this.structures[this.step].crystal.basis =
						extractBasis(basisSides[0],  basisSides[1],  basisSides[2],
									 basisAngles[0], basisAngles[1], basisAngles[2]);
					}
					break;
				case "_cell_angle_alpha":
				case "_cell.angle_alpha":
					basisAngles[0] = Number.parseFloat(value);
					break;
				case "_cell_angle_beta":
				case "_cell.angle_beta":
					basisAngles[1] = Number.parseFloat(value);
					break;
				case "_cell_angle_gamma":
				case "_cell.angle_gamma":
					basisAngles[2] = Number.parseFloat(value);
					if(basisSides[0] !== 0 && basisSides[1] !== 0 && basisSides[2] !== 0) {
					this.structures[this.step].crystal.basis =
							extractBasis(basisSides[0],  basisSides[1],  basisSides[2],
										 basisAngles[0], basisAngles[1], basisAngles[2]);
					}
					break;
			}
		}

		// Close a table at the end of the file
		if(isInLoop) this.useTable();

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

			if(hasNoUnitCell(this.structures[this.step].crystal.basis)) return;

			const fracX  = this.tbl.getColumn("_atom_site_fract_x");
			const fracY  = this.tbl.getColumn("_atom_site_fract_y");
			const fracZ  = this.tbl.getColumn("_atom_site_fract_z");
			const label  = this.tbl.getColumn("_atom_site_label");
			const symbol = this.tbl.getColumn("_atom_site_type_symbol");
			const hasSymbol = symbol.length > 0;

			const natoms = fracX.length;
			for(let i=0; i < natoms; ++i) {
				const fx = Number.parseFloat(fracX[i]);
				const fy = Number.parseFloat(fracY[i]);
				const fz = Number.parseFloat(fracZ[i]);
				const az = (hasSymbol ? symbol[i] : label[i]).replaceAll(/[^a-z]/gi, "");
				const atom: Atom = {
					atomZ: getAtomicNumber(az),
					label: label.length > 0 ? label[i] : symbol[i],
					position: fractionalToCartesianCoordinates(this.structures[this.step].crystal.basis,
															   fx, fy, fz)
				};
				this.structures[this.step].atoms.push(atom);
			}
		}
		else if(this.tbl.hasColumn("_symmetry_equiv_pos_as_xyz")) {

			this.structures[this.step].crystal.spaceGroup =
				this.tbl.getColumn("_symmetry_equiv_pos_as_xyz").join("\n");
		}
		else if(this.tbl.hasColumn("_atom_site_cartn_x")) {

			const cartnX   = this.tbl.getColumn("_atom_site_cartn_x");
			const cartnY   = this.tbl.getColumn("_atom_site_cartn_y");
			const cartnZ   = this.tbl.getColumn("_atom_site_cartn_z");
			const label    = this.tbl.getColumn("_atom_site_label_atom_id");
			const atomType = this.tbl.getColumn("_atom_site_type_symbol");
			const hasAtomType = atomType.length > 0;
			const natoms = cartnX.length;
			for(let i=0; i < natoms; ++i) {
				const x = Number.parseFloat(cartnX[i]);
				const y = Number.parseFloat(cartnY[i]);
				const z = Number.parseFloat(cartnZ[i]);
				const symbol = (hasAtomType ? atomType[i] : label[i]).replaceAll(/[^a-z]/gi, "");
				const atom: Atom = {
					atomZ: getAtomicNumber(symbol),
					label: label[i],
					position: [x, y, z]
				};
				this.structures[this.step].atoms.push(atom);
			}
		}
		else if(this.tbl.hasColumn("_space_group_symop_operation_xyz")) {

			this.structures[this.step].crystal.spaceGroup =
				this.tbl.getColumn("_space_group_symop_operation_xyz").join("\n");
		}
	}
}
