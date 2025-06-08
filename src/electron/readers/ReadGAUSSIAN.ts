/**
 * Reader for Gaussian cube formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {createReadStream} from "node:fs";
import {createInterface} from "node:readline/promises";
import {getAtomicSymbol} from "../modules/AtomData";
import {EmptyStructure} from "../modules/EmptyStructure";
import type {Structure, Atom,
			 ReaderImplementation, ReaderOptions} from "@/types";

/** Line read type */
const LineType = {
	__proto__: undefined,
    comment1: 0,
    comment2: 1,
	origin:   2,
    basis:    3,
	orbitals: 4,
	values:   5,
    atoms:    6,
	exit:     7,
} as const;

export class ReaderGAUSSIAN implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @param options - Options for the reader
	 * @returns The set of structures read
	 * @throws Error.
	 * "Malformed file (origin line)", "No atoms in the file", "Malformed file (basis line)",
	 * "Malformed file (atoms line)"
	 */
	async readStructure(filename: string, options?: ReaderOptions): Promise<Structure[]> {

		let lineType: number = LineType.comment1;
		let orbitalsPresent = false;
		let natoms = 0;
		let idxBasis = 0;
		const voxelsPerSide = [0, 0, 0];
		let useBohr = false;
		const sidesPerVoxel = [0, 0, 0, 0, 0, 0, 0, 0, 0];
		const BOHR_TO_ANGSTROM = 0.529177;
		let voxels: number[] = [];
		let nvoxels = 0;
		let idxVoxels = 0;

		const structure: Structure = new EmptyStructure();
		structure.volume = [{sides: [0, 0, 0], values: []}];

		const stream = createInterface(createReadStream(filename, {encoding: "utf8"}));
		for await (const line of stream) {

			const fields = line.trim().split(/\s+/);

			switch(lineType) {
				case LineType.comment1:
					lineType = LineType.comment2;
					break;
				case LineType.comment2:
					lineType = LineType.origin;
					break;
				case LineType.origin:

					if(fields.length < 4) throw Error("Malformed file (origin line)");
					natoms = Number.parseInt(fields[0], 10);
					if(natoms === 0) throw Error("No atoms in the file");
					if(natoms < 0) {
						orbitalsPresent = true;
						natoms = -natoms;
					}

					structure.crystal.origin = [
						Number.parseFloat(fields[1]),
						Number.parseFloat(fields[2]),
						Number.parseFloat(fields[3]),
					];

					lineType = LineType.basis;
					break;
				case LineType.basis: {

					if(fields.length < 4) throw Error(`Malformed file (basis line ${idxBasis+1})`);
					voxelsPerSide[idxBasis] = Number.parseInt(fields[0], 10);
					const j = 3*idxBasis;
					sidesPerVoxel[j]   = Number.parseFloat(fields[1]);
					sidesPerVoxel[j+1] = Number.parseFloat(fields[2]);
					sidesPerVoxel[j+2] = Number.parseFloat(fields[3]);

					++idxBasis;
					if(idxBasis === 3) {

						if(options?.useBohr) {
							useBohr = options.useBohr;
						}
						else {
							useBohr = voxelsPerSide[0] < 0;
							if(useBohr) voxelsPerSide[0] = -voxelsPerSide[0];
						}

						// Compute the unit cell and adjust the origin
						for(let i=0; i < 3; ++i) {
							const k = 3*i;
							structure.crystal.basis[k]   = sidesPerVoxel[k]*voxelsPerSide[i];
							structure.crystal.basis[k+1] = sidesPerVoxel[k+1]*voxelsPerSide[i];
							structure.crystal.basis[k+2] = sidesPerVoxel[k+2]*voxelsPerSide[i];

							structure.volume[0].sides[i] = voxelsPerSide[i]+1;
						}

						if(useBohr) {
							structure.crystal.basis[0] *= BOHR_TO_ANGSTROM;
							structure.crystal.basis[1] *= BOHR_TO_ANGSTROM;
							structure.crystal.basis[2] *= BOHR_TO_ANGSTROM;
							structure.crystal.basis[3] *= BOHR_TO_ANGSTROM;
							structure.crystal.basis[4] *= BOHR_TO_ANGSTROM;
							structure.crystal.basis[5] *= BOHR_TO_ANGSTROM;
							structure.crystal.basis[6] *= BOHR_TO_ANGSTROM;
							structure.crystal.basis[7] *= BOHR_TO_ANGSTROM;
							structure.crystal.basis[8] *= BOHR_TO_ANGSTROM;

							structure.crystal.origin[0] *= BOHR_TO_ANGSTROM;
							structure.crystal.origin[1] *= BOHR_TO_ANGSTROM;
							structure.crystal.origin[2] *= BOHR_TO_ANGSTROM;
						}

						const nv1 = voxelsPerSide[0];
						const nv2 = voxelsPerSide[1];
						const nv3 = voxelsPerSide[2];

						nvoxels = nv1*nv2*nv3;
						voxels = Array<number>(nvoxels).fill(0);
						lineType = LineType.atoms;
					}
					break;
				}
				case LineType.atoms: {

					if(fields.length < 5) throw Error(`Malformed file (atoms line ${idxBasis+1})`);

					const atomZ = Number.parseInt(fields[0], 10);
					const atom: Atom = {
						atomZ,
						label: getAtomicSymbol(atomZ),
						chain: "",
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

						const nvx = voxelsPerSide[0];
						const nvy = voxelsPerSide[1];
						const nvz = voxelsPerSide[2];

						const nx = voxelsPerSide[0]+1;
						const ny = voxelsPerSide[1]+1;
						const nz = voxelsPerSide[2]+1;
						structure.volume[0].values = Array<number>(nx*ny*nz).fill(0);

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
