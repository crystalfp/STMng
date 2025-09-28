/**
 * Writer for PDB formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-05-05
 */

import {openSync, closeSync, writeSync} from "node:fs";
import {basisToLengthAngles, hasUnitCell, invertBasis, isNormalBond, reducingToFractionalCoordinates} from "../modules/Helpers";
import type {WriterImplementation, Structure, CtrlParams} from "@/types";
import log from "electron-log";
export class WriterPDB implements WriterImplementation {

	writeStructure(filename: string, structures: Structure[]): CtrlParams {

		if(structures.length === 0) {
			return {payload: "Error", error: "Nothing to write"};
		}
		const multiple = structures.length > 1;

        try {
            const fd = openSync(filename, "w");
            for(const structure of structures) {

                if(multiple) writeSync(fd, "HEADER\n");

                // Access the structure
                const {crystal, bonds} = structure;
                const {basis, origin, spaceGroup} = crystal;

                if(hasUnitCell(basis)) {

                    const lengthAngles = basisToLengthAngles(basis);
                    writeSync(fd, "CRYST1" +
                        lengthAngles[0].toFixed(3).padStart(9, " ") +
                        lengthAngles[1].toFixed(3).padStart(9, " ") +
                        lengthAngles[2].toFixed(3).padStart(9, " ") +
                        lengthAngles[3].toFixed(2).padStart(7, " ") +
                        lengthAngles[4].toFixed(2).padStart(7, " ") +
                        lengthAngles[5].toFixed(2).padStart(7, " ") +
                        spaceGroup.padStart(12, " ") + "   1\n");

                    // Add ORIGXn records to put cell origin
                    writeSync(fd, "ORIGX1      1.000000  0.000000  0.000000     " +
                        origin[0].toFixed(5).padStart(10, " ") + "\n");
                    writeSync(fd, "ORIGX2      0.000000  1.000000  0.000000     " +
                        origin[1].toFixed(5).padStart(10, " ") + "\n");
                    writeSync(fd, "ORIGX3      0.000000  0.000000  1.000000     " +
                        origin[2].toFixed(5).padStart(10, " ") + "\n");

                    try {
                        const inverse = invertBasis(basis);

                        const o = [
                            -(inverse[0]*origin[0]+inverse[1]*origin[1]+inverse[2]*origin[2]),
                            -(inverse[3]*origin[0]+inverse[4]*origin[1]+inverse[5]*origin[2]),
                            -(inverse[6]*origin[0]+inverse[7]*origin[1]+inverse[8]*origin[2]),
                        ];
                        writeSync(fd, "SCALE1    " +
                                        inverse[0].toFixed(6).padStart(10, " ") +
                                        inverse[1].toFixed(6).padStart(10, " ") +
                                        inverse[2].toFixed(6).padStart(10, " ") +
                                        "     " + o[0].toFixed(5).padStart(10, " ") + "\n");
                        writeSync(fd, "SCALE2    " +
                                        inverse[3].toFixed(6).padStart(10, " ") +
                                        inverse[4].toFixed(6).padStart(10, " ") +
                                        inverse[5].toFixed(6).padStart(10, " ") +
                                        "     " + o[1].toFixed(5).padStart(10, " ") + "\n");
                        writeSync(fd, "SCALE3    " +
                                        inverse[6].toFixed(6).padStart(10, " ") +
                                        inverse[7].toFixed(6).padStart(10, " ") +
                                        inverse[8].toFixed(6).padStart(10, " ") +
                                        "     " + o[2].toFixed(5).padStart(10, " ") + "\n");
                    }
                    catch(error) {
                        log.error(`SCALEn not written. Error: ${(error as Error).message}`);
                    }
                }

                // Remove duplicates
				const reduced = reducingToFractionalCoordinates(structure);

                for(let i=0; i < reduced.atoms.length; ++i) {

                    const {symbol, label, chain, cart} = reduced.atoms[i];
                    const labelShort = label.length > 4 ? label.slice(-4) : label.padStart(4, " ");
                    const chainId = chain === "" ? "A" : chain;
                    writeSync(fd, "ATOM  " + i.toString().padStart(5, " ") + " " +
                        labelShort + "     " +
                        chainId + "   1    " +
                        cart[0].toFixed(3).padStart(8, " ") +
                        cart[1].toFixed(3).padStart(8, " ") +
                        cart[2].toFixed(3).padStart(8, " ") +
                        "  1.00  1.00          " +
                        symbol.padStart(2, " ") + "\n");
                }

                if(bonds.length === 0) continue;

                // Map atoms positions for bonds
                const mapAtoms = new Map<number, number>();
                for(let i=0; i < reduced.atoms.length; ++i) {
                    mapAtoms.set(reduced.atoms[i].index, i);
                }

                const ib  = Array.from({length: reduced.atoms.length}, () => []) as number[][];
                const ihb = Array.from({length: reduced.atoms.length}, () => []) as number[][];
                for(let i=0; i < reduced.atoms.length-1; ++i) {
                    for(let j=i+1; j < reduced.atoms.length; ++j) {

                        for(const bond of bonds) {
                            const from = mapAtoms.get(bond.from);
                            const to = mapAtoms.get(bond.to);

                            if(from === i && to === j) {
                                if(isNormalBond(bond)) ib[i].push(j);
                                else ihb[i].push(j);
                            }
                            else if(from === j && to === i) {

                                if(isNormalBond(bond)) ib[j].push(i);
                                else ihb[j].push(i);
                            }
                        }
                    }
                }

                for(let i=0; i < reduced.atoms.length; ++i) {

                    const nb = ib[i].length;
                    const nhb = ihb[i].length;

                    if(nb > 0 || nhb > 0) {
                        writeSync(fd, `CONECT${i.toString().padStart(5, " ")}`);
                        if(nb > 0) writeSync(fd, ib[i][0].toString().padStart(5, " "));
                        else writeSync(fd, "      ");
                        if(nb > 1) writeSync(fd, ib[i][1].toString().padStart(5, " "));
                        else writeSync(fd, "      ");
                        if(nb > 2) writeSync(fd, ib[i][2].toString().padStart(5, " "));
                        else writeSync(fd, "      ");
                        if(nb > 3) writeSync(fd, ib[i][3].toString().padStart(5, " "));
                        else writeSync(fd, "      ");
                        if(nhb > 0) writeSync(fd, ihb[i][0].toString().padStart(5, " "));
                        if(nhb > 1) writeSync(fd, ihb[i][1].toString().padStart(5, " "));
                        writeSync(fd, "\n");
                    }
                    if(nb > 4 || nhb > 2) {
                        writeSync(fd, `CONECT${i.toString().padStart(5, " ")}`);
                        if(nb > 4) writeSync(fd, ib[i][4].toString().padStart(5, " "));
                        else writeSync(fd, "      ");
                        if(nb > 5) writeSync(fd, ib[i][5].toString().padStart(5, " "));
                        else writeSync(fd, "      ");
                        if(nb > 6) writeSync(fd, ib[i][6].toString().padStart(5, " "));
                        else writeSync(fd, "      ");
                        if(nb > 7) writeSync(fd, ib[i][7].toString().padStart(5, " "));
                        else writeSync(fd, "      ");
                        if(nhb > 2) writeSync(fd, ihb[i][2].toString().padStart(5, " "));
                        if(nhb > 3) writeSync(fd, ihb[i][3].toString().padStart(5, " "));
                        writeSync(fd, "\n");
                    }

                    if(nhb > 4) {
                        writeSync(fd, `CONECT${i.toString().padStart(5, " ")}` + " ".repeat(20));
                        if(nhb > 4) writeSync(fd, ihb[i][4].toString().padStart(5, " "));
                        if(nhb > 5) writeSync(fd, ihb[i][5].toString().padStart(5, " "));
                        writeSync(fd, "\n");
                    }
                }
            }

            writeSync(fd, "END   \n");
            closeSync(fd);
            return {payload: "Success!"};
        }
        catch(error) {
            return {payload: "Error", error: (error as Error).message};
        }
    }
}
