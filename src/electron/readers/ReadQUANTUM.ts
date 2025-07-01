/**
 * Reader for Quantum Espresso input files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-06-28
 */
import type {ReaderImplementation, Structure, Atom} from "@/types";
import {readFile} from "node:fs/promises";
import {EmptyStructure} from "../modules/EmptyStructure";
import {convertSpaceGroupNumber} from "../modules/NativeFunctions";
import log from "electron-log";
import {getAtomicNumber} from "../modules/AtomData";
import {fractionalToCartesianCoordinates} from "../modules/Helpers";


export class ReaderQUANTUM implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @returns The set of structures read
	 */
	async readStructure(filename: string): Promise<Structure[]> {

		const structure: Structure = new EmptyStructure();
		const {atoms, crystal} = structure;
		const {basis} = crystal;

		const content = await readFile(filename, "utf8");
		const lines = content
						.replaceAll(",", "\n")
						.replaceAll("\r\n", "\n")
						.replaceAll(/\n{2,}/g, "\n")
						.replaceAll(/ +/g, " ")
						.replaceAll(/ ?\n ?/g, "\n")
						.replace(/^ /, "")
						.replace(/\n$/, "")
						.replaceAll(/ ?= ?/g, "=")
						.split("\n");

		let ibrav = 0;
		const celldm = [0, 0, 0, 0, 0, 0, 0];
		let a = 1;
		let b = 1;
		let c = 1;
		let cosAB = 1;
		let cosAC = 1;
		let cosBC = 1;
		let hasCelldm = false;
		let inPositions = false;
		let positionKind = "";
		const positions: number[][] = [];
		const label: string[] = [];
		const atomZ: number[] = [];
		let inBasis = false;
		let basisKind = "";
		let basisLine = 0;
		let alat = 0;
		let spaceGroupNumber = 0;
		let inputAtoms = 0;

		for(const line of lines) {

			if(inPositions) {
				const fields = line.split(" ");
				label.push(fields[0]);
				let type = fields[0].replace(/\d+/, "");
				let zz = getAtomicNumber(type);
				if(zz === 0) {
					if(type.length > 2) {
						type = type.slice(0, 2);
						zz = getAtomicNumber(type);
					}
					if(zz === 0) {
						type = type.slice(0, 1);
						zz = getAtomicNumber(type);
					}
					atomZ.push(zz);
				}
				atomZ.push(zz);

				const x = Number.parseFloat(fields[1]);
				const y = Number.parseFloat(fields[2]);
				const z = Number.parseFloat(fields[3]);
				positions.push([x, y, z]);
				--inputAtoms;
				if(inputAtoms === 0) {
					inPositions = false;
				}
			}
			else if(inBasis) {

				const fields = line.split(" ");
				const x = Number.parseFloat(fields[0]);
				const y = Number.parseFloat(fields[1]);
				const z = Number.parseFloat(fields[2]);
				basis[basisLine] = x;
				basis[basisLine+1] = y;
				basis[basisLine+2] = z;
				basisLine += 3;
				if(basisLine === 9) {
					inBasis = false;
				}
			}
			else if(line.startsWith("ibrav")) {
				ibrav = Number.parseInt(line.split("=")[1], 10);
			}
			else if(line.startsWith("nat=")) {
				inputAtoms = Number.parseInt(line.split("=")[1], 10);
			}
			else if(line.startsWith("celldm")) {
				const fields = line.split(/[()=]/);
				const ncell = Number.parseInt(fields[1], 10);
				celldm[ncell] = Number.parseFloat(fields[3].replace("D", "E"));
				hasCelldm = true;
			}
			else if(line.startsWith("A=")) {
				a = Number.parseFloat(line.split("=")[1]);
			}
			else if(line.startsWith("B=")) {
				b = Number.parseFloat(line.split("=")[1]);
			}
			else if(line.startsWith("C=")) {
				c = Number.parseFloat(line.split("=")[1]);
			}
			else if(line.startsWith("cosAB=")) {
				cosAB = Number.parseFloat(line.split("=")[1]);
			}
			else if(line.startsWith("cosAC=")) {
				cosAC = Number.parseFloat(line.split("=")[1]);
			}
			else if(line.startsWith("cosBC=")) {
				cosBC = Number.parseFloat(line.split("=")[1]);
			}
			else if(line.startsWith("space_group=")) {
				spaceGroupNumber = Number.parseFloat(line.split("=")[1]);
			}
			else if(line.startsWith("ATOMIC_POSITIONS")) {
				inPositions = true;
				positionKind = line.split(" ")[1].replaceAll(/[{}]/g, "");
			}
			else if(line.startsWith("CELL_PARAMETERS")) {
				inPositions = false;
				inBasis = true;
				basisKind = line.split(" ")[1].replaceAll(/[{}]/g, "");
				basisLine = 0;
			}
		}

		// Unify cell parameters
		if(hasCelldm) {

			a = celldm[1]*0.529177249;
			b = celldm[2]*a;
			c = celldm[3]*a;
			cosAB = celldm[6];
			cosAC = celldm[5];
			cosBC = celldm[4];
		}
		alat = a;
		const halfAlat = alat*0.5;

		// Compute the basis vectors
		switch(ibrav) {
			case 0:
				if(basisKind === "bohr") {
					for(let i=0; i < 9; ++i) basis[i] *= 0.529177210544;
				}
				else if(basisKind === "alat" || basisKind === "") {
					for(let i=0; i < 9; ++i) basis[i] *= alat;
				}
				break;
			case 1:
				basis[0] = alat;
				basis[4] = alat;
				basis[8] = alat;
				break;
			case 2:
				basis[0] = -halfAlat;
				basis[2] =  halfAlat;
				basis[4] =  halfAlat;
				basis[6] = -halfAlat;
				basis[7] =  halfAlat;
				break;
			case 3:
				basis[0] =  halfAlat;
				basis[1] =  halfAlat;
				basis[2] =  halfAlat;
				basis[3] = -halfAlat;
				basis[4] =  halfAlat;
				basis[5] =  halfAlat;
				basis[6] = -halfAlat;
				basis[7] = -halfAlat;
				basis[8] =  halfAlat;
				break;
			case -3:
				basis[0] = -halfAlat;
				basis[1] =  halfAlat;
				basis[2] =  halfAlat;
				basis[3] =  halfAlat;
				basis[4] = -halfAlat;
				basis[5] =  halfAlat;
				basis[6] =  halfAlat;
				basis[7] =  halfAlat;
				basis[8] = -halfAlat;
				break;
			case 4:
				basis[0] =  alat;
				basis[3] = -halfAlat;
				basis[4] =  alat*0.866025403784439;
				basis[8] =  c;
				break;
			case 5: {
				const tx = Math.sqrt((1-cosBC)/2);
				const ty = Math.sqrt((1-cosBC)/6);
				const tz = Math.sqrt((1+2*cosBC)/3);
				basis[0] =  alat*tx;
				basis[1] = -alat*ty;
				basis[2] =  alat*tz;
				basis[4] =  alat*2*ty;
				basis[5] =  alat*tz;
				basis[6] = -alat*tx;
				basis[7] = -alat*ty;
				basis[8] =  alat*tz;
				break;
			}
			case -5: {
				const ty = Math.sqrt((1-cosBC)/6);
				const tz = Math.sqrt((1+2*cosBC)/3);
				const aPrime = alat*0.577350269189626;
				const u = tz - 2.82842712474619*ty;
				const v = tz + 1.4142135623731*ty;
				basis[0] = aPrime*u;
				basis[1] = aPrime*v;
				basis[2] = aPrime*v;
				basis[3] = aPrime*v;
				basis[4] = aPrime*u;
				basis[5] = aPrime*v;
				basis[6] = aPrime*v;
				basis[7] = aPrime*v;
				basis[8] = aPrime*u;
				break;
			}
			case 6:
				basis[0] = alat;
				basis[4] = alat;
				basis[8] = c;
				break;
			case 7:
				basis[0] =  halfAlat;
				basis[1] = -halfAlat;
				basis[2] =  c/2;
				basis[3] =  halfAlat;
				basis[4] =  halfAlat;
				basis[5] =  c/2;
				basis[6] = -halfAlat;
				basis[7] = -halfAlat;
				basis[8] =  c/2;
				break;
			case 8:
				basis[0] = alat;
				basis[4] = b;
				basis[8] = c;
				break;
			case 9:
				basis[0] = halfAlat;
				basis[1] = b/2;
				basis[3] = -halfAlat;
				basis[4] = b/2;
				basis[8] = c;
				break;
			case -9:
				basis[0] = halfAlat;
				basis[1] = -b/2;
				basis[3] = halfAlat;
				basis[4] = b/2;
				basis[8] = c;
				break;
			case 91:
				basis[0] = alat;
				basis[4] = b/2;
				basis[5] = -c/2;
				basis[7] = b/2;
				basis[8] = c/2;
				break;
			case 10:
				basis[0] = halfAlat;
				basis[2] = c/2;
				basis[3] = halfAlat;
				basis[4] = b/2;
				basis[7] = b/2;
				basis[8] = c/2;
				break;
			case 11:
				basis[0] = halfAlat;
				basis[1] = b/2;
				basis[2] = b/2;
				basis[3] = -halfAlat;
				basis[4] = b/2;
				basis[5] = c/2;
				basis[6] = -halfAlat;
				basis[7] = -b/2;
				basis[8] = c/2;
				break;
			case 12:
				basis[0] = alat;
				basis[3] = b*cosBC; // Really it is celldm[4] = cos(ab)
				basis[4] = b*Math.sqrt(1-cosBC*cosBC);
				basis[8] = c;
				break;
			case -12:
				basis[0] = alat;
				basis[4] = b;
				basis[6] = c*cosAC;
				basis[8] = c*Math.sqrt(1-cosAC*cosAC);
				break;
			case 13:
				basis[0] = halfAlat;
				basis[2] = -c/2;
				basis[3] = b*cosBC;
				basis[4] = b*Math.sqrt(1-cosBC*cosBC);
				basis[6] = halfAlat;
				basis[8] = c/2;
				break;
			case -13:
				basis[0] = halfAlat;
				basis[1] = b/2;
				basis[3] = -halfAlat;
				basis[4] = b/2;
				basis[6] = c*cosAC;
				basis[8] = c*Math.sqrt(1-cosAC*cosAC);
				break;
			case 14: {
				const sg = Math.sqrt(1-cosAB*cosAB);

				basis[0] = alat;
				basis[3] = b*cosAB;
				basis[4] = b*sg;
				basis[6] = c*cosAC;
				basis[7] = c*(cosBC-cosAC*cosAB)/sg;
				basis[8] = c*Math.sqrt(1+2*cosBC*cosAC*cosAB-cosBC*cosBC-cosAC*cosAC-cosAB*cosAB)/sg;
				break;
			}
		}

		if(spaceGroupNumber !== 0) {
			const computed = convertSpaceGroupNumber(spaceGroupNumber, 0);
			switch(computed.errorNumber) {
				case 0:
					crystal.spaceGroup = computed.spaceGroup;
					break;
				case 1:
					log.error(`Space group variation invalid for sg ${spaceGroupNumber}`);
					crystal.spaceGroup = computed.spaceGroup;
					break;
				default: throw Error(computed.spaceGroup);
			}
		}
		else if(positionKind === "crystal_sg") throw Error("Missing space group number");

		// Atoms
		const natoms = atomZ.length;
		switch(positionKind) {
			case "alat":
				for(let i=0; i < natoms; ++i) {
					positions[i][0] *= alat;
					positions[i][1] *= alat;
					positions[i][2] *= alat;
				}
				break;
			case "bohr":
				for(let i=0; i < natoms; ++i) {
					positions[i][0] *= 0.529177210544;
					positions[i][1] *= 0.529177210544;
					positions[i][2] *= 0.529177210544;
				}
				break;
			case "crystal_sg":
			case "crystal":
				for(let i=0; i < natoms; ++i) {
					const fx = positions[i][0];
					const fy = positions[i][1];
					const fz = positions[i][2];
					const position = fractionalToCartesianCoordinates(basis, fx, fy, fz);
					positions[i][0] = position[0];
					positions[i][1] = position[1];
					positions[i][2] = position[2];
				}
				break;
		}

		for(let i=0; i < natoms; ++i) {
			const atom: Atom = {
				atomZ: atomZ[i],
				label: label[i],
				chain: "",
				position: [positions[i][0], positions[i][1], positions[i][2]],
			};
			atoms.push(atom);
		}

		return [structure];
	}
}
