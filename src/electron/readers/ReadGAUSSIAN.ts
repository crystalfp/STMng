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
		let nv1=0, nv2=0, nv3=0;
		let idxVoxels = 0;

		let nvy=0, nvz=0;

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

					if(fields.length !== 4) throw Error("Malformed file (origin line)");
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

					if(fields.length !== 4) throw Error(`Malformed file (basis line ${idxBasis+1})`);
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

							crystal.origin[i] -= (sides[i]+sides[i+3]+sides[i+6])/2;

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

						nv1 = subdivisions[0];
						nv2 = subdivisions[1];
						nv3 = subdivisions[2];

						nvy = subdivisions[1];
						nvz = subdivisions[2];

						nvoxels = nv1*nv2*nv3;
						voxels = Array(nvoxels).fill(0) as number[];
						lineType = LineType.atoms;
					}
					break;
				}
				case LineType.atoms: {
					if(fields.length !== 5) throw Error(`Malformed file (atoms line ${idxBasis+1})`);

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

						const n1 = subdivisions[0]+1;
						const n2 = subdivisions[1]+1;
						const n3 = subdivisions[2]+1;
						structure.volume[0].values = Array(n1*n2*n3).fill(52) as number[];

						for(let i = 0; i < n1; i++) {
							let x0 = i - 1; if(x0 < 0)    x0 = nv1-1;
							let x1 = i;     if(x1 >= nv1) x1 = 0;

							for(let j = 0; j < n2; j++) {
								let y0 = j - 1; if(y0 < 0)    y0 = nv2-1;
								let y1 = j;     if(y1 >= nv2) y1 = 0;

								for(let k = 0; k < n3; k++) {
									let z0 = k - 1; if(z0 < 0)    z0 = nv3-1;
									let z1 = k;     if(z1 >= nv3) z1 = 0;

									structure.volume[0].values[k*n1*n2+j*n1+i] = (
										voxels[z0+nvz*(y0+nvy*x0)] +
										voxels[z0+nvz*(y0+nvy*x1)] +
										voxels[z0+nvz*(y1+nvy*x0)] +
										voxels[z0+nvz*(y1+nvy*x1)] +
										voxels[z1+nvz*(y0+nvy*x0)] +
										voxels[z1+nvz*(y0+nvy*x1)] +
										voxels[z1+nvz*(y1+nvy*x0)] +
										voxels[z1+nvz*(y1+nvy*x1)])/8;
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
