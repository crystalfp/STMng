/**
 * Reader for Gaussian cube formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import fs from "node:fs";
import * as rd from "node:readline/promises";
import {getAtomicSymbol} from "../modules/AtomData";
import type {ReaderImplementation, ReaderOptions} from "../types";
import type {Structure, Crystal, Atom} from "../../types";

/** Line read type */
const enum LineType {
    comment1,
    comment2,
	origin,
    basis,
	orbitals,
	values,
    atoms,
	exit,
}

export class ReaderGAUSSIAN implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @param options - Options for the reader
	 * @returns The set of structures read
	 */
	async readStructure(filename: string, options?: ReaderOptions): Promise<Structure[]> {

		let lineType: LineType = LineType.comment1;
		let orbitalsPresent = false;
		let natoms = 0;
		let idxBasis = 0;
		const subdivisions = [0, 0, 0];
		let useBohr = false;
		const sides = [0, 0, 0, 0, 0, 0, 0, 0, 0];
		const BOHR_TO_ANGSTROM = 0.529177;
		let voxels: number[] = [];
		let nvoxels = 0;
		let idxVoxels = 0;

		// let nvy=0, nvz=0;

		const crystal: Crystal = {
			basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
			origin: [0, 0, 0],
			spaceGroup: ""
		};

		const structure: Structure = 	{
			crystal,
			atoms: [],
			bonds: [],
			volume: [{sides: [0, 0, 0], values: []}]
		};

		const stream = rd.createInterface(fs.createReadStream(filename));
		for await (const line of stream) {

			const fields = line.trim().split(/ +/);

			switch(lineType) {
				case LineType.comment1:
					lineType = LineType.comment2;
					break;
				case LineType.comment2:
					lineType = LineType.origin;
					break;
				case LineType.origin: {

					if(fields.length < 4) throw Error("Malformed file (origin line)");
					natoms = Number.parseInt(fields[0]);
					if(natoms === 0) throw Error("No atoms in the file");
					if(natoms < 0) {
						orbitalsPresent = true;
						natoms = -natoms;
					}

					crystal.origin = [
						Number.parseFloat(fields[1]),
						Number.parseFloat(fields[2]),
						Number.parseFloat(fields[3]),
					];

					lineType = LineType.basis;
					break;
				}
				case LineType.basis: {

					if(fields.length < 4) throw Error(`Malformed file (basis line ${idxBasis+1})`);
					subdivisions[idxBasis] = Number.parseInt(fields[0]);
					sides[3*idxBasis]   = Number.parseFloat(fields[1]);
					sides[3*idxBasis+1] = Number.parseFloat(fields[2]);
					sides[3*idxBasis+2] = Number.parseFloat(fields[3]);

					++idxBasis;
					if(idxBasis === 3) {

						if(options?.useBohr) {
							useBohr = options.useBohr;
						}
						else {
							useBohr = subdivisions[0] < 0;
							if(useBohr) subdivisions[0] = -subdivisions[0];
						}

						// Compute the unit cell and adjust the origin
						for(let i=0; i < 3; ++i) {
							crystal.basis[3*i]   = sides[3*i]*subdivisions[i];
							crystal.basis[3*i+1] = sides[3*i+1]*subdivisions[i];
							crystal.basis[3*i+2] = sides[3*i+2]*subdivisions[i];

							structure.volume[0].sides[i] = subdivisions[i]+1;
						}

						if(useBohr) {
							crystal.basis[0] *= BOHR_TO_ANGSTROM;
							crystal.basis[1] *= BOHR_TO_ANGSTROM;
							crystal.basis[2] *= BOHR_TO_ANGSTROM;
							crystal.basis[3] *= BOHR_TO_ANGSTROM;
							crystal.basis[4] *= BOHR_TO_ANGSTROM;
							crystal.basis[5] *= BOHR_TO_ANGSTROM;
							crystal.basis[6] *= BOHR_TO_ANGSTROM;
							crystal.basis[7] *= BOHR_TO_ANGSTROM;
							crystal.basis[8] *= BOHR_TO_ANGSTROM;

							crystal.origin[0] *= BOHR_TO_ANGSTROM;
							crystal.origin[1] *= BOHR_TO_ANGSTROM;
							crystal.origin[2] *= BOHR_TO_ANGSTROM;
						}

						const nv1 = subdivisions[0];
						const nv2 = subdivisions[1];
						const nv3 = subdivisions[2];

						nvoxels = nv1*nv2*nv3;
						voxels = Array(nvoxels).fill(0) as number[];
						lineType = LineType.atoms;
					}
					break;
				}
				case LineType.atoms: {

					if(fields.length < 5) throw Error(`Malformed file (atoms line ${idxBasis+1})`);

					const atomZ = Number.parseInt(fields[0]);
					const atom: Atom = {
						atomZ,
						label: getAtomicSymbol(atomZ),
						position: [
							Number.parseFloat(fields[2]),
							Number.parseFloat(fields[3]),
							Number.parseFloat(fields[4]),
						]
					};

					// If measurement unit is bohr
					if(useBohr) {
						atom.position[0] *= BOHR_TO_ANGSTROM;
						atom.position[1] *= BOHR_TO_ANGSTROM;
						atom.position[2] *= BOHR_TO_ANGSTROM;
					}

					structure.atoms.push(atom);
					--natoms;
					if(natoms === 0) {
						lineType = orbitalsPresent ? LineType.orbitals : LineType.values;
					}

					break;
				}
				case LineType.orbitals:
					lineType = LineType.values;
					break;
				case LineType.values:

					for(const field of fields) {
						voxels[idxVoxels++] = Number.parseFloat(field);
					}
					nvoxels -= fields.length;

					if(nvoxels === 0) {

						const nvx = subdivisions[0];
						const nvy = subdivisions[1];
						const nvz = subdivisions[2];

						const nx = subdivisions[0]+1;
						const ny = subdivisions[1]+1;
						const nz = subdivisions[2]+1;
						structure.volume[0].values = Array(nx*ny*nz).fill(0) as number[];

						for(let iz=0; iz < nz; ++iz) {

							const z0 = iz === 0 ? nvz-1 : iz-1;
							const z1 = iz === nz-1 ? 0 : iz;

							for(let iy=0; iy < ny; ++iy) {

								const y0 = iy === 0 ? nvy-1 : iy-1;
								const y1 = iy === ny-1 ? 0 : iy;

								for(let ix=0; ix < nx; ++ix) {

									const x0 = ix === 0 ? nvx-1 : ix-1;
									const x1 = ix === nx-1 ? 0 : ix;

									structure.volume[0].values[ix+(iy+iz*ny)*nx] = (
										voxels[z0 + (y0 + x0 * nvy) * nvz] +
										voxels[z1 + (y0 + x0 * nvy) * nvz] +
										voxels[z0 + (y1 + x0 * nvy) * nvz] +
										voxels[z1 + (y1 + x0 * nvy) * nvz] +
										voxels[z0 + (y0 + x1 * nvy) * nvz] +
										voxels[z1 + (y0 + x1 * nvy) * nvz] +
										voxels[z0 + (y1 + x1 * nvy) * nvz] +
										voxels[z1 + (y1 + x1 * nvy) * nvz])/8;
								}
							}
						}

						lineType = LineType.exit;
					}
					break;
			}

			if(lineType === LineType.exit) break;
		}

		return [structure];
	}
}
