// Tool to convert OpenBabel element.txt file into the atom-data.json file used by STMng
// Usage: tsx convert.mts > public/atom-data.json
// Beware! do it under shell or cmd. Under power shell the output file is not utf-8
//
import fs from "node:fs";
import {createInterface} from "node:readline/promises";

interface OneAtomData {

	/** Element symbol */
	symbol: string;

	/** Covalent radii (in Angstrom). 1.6 if unknown */
	rCov: number;

	/** Van der Waals radii (in Angstrom). 2.0 if unknown */
	rVdW: number;

	/** Maximum bond valence. 6 if unknown */
	maxBonds: number;

	/** RGB color for visualization (format: "#RRGGBB") */
	color: string;
}

const out: string[] = [];
const reader = createInterface(fs.createReadStream("element.txt", {encoding: "utf8"}));
for await (const lineRaw of reader) {

	const line = lineRaw.replace(/#.+$/, "").trim();
	if(line === "") continue;
	const fld = line.trim().split("\t")

	const red =   Math.round((Number.parseFloat(fld[11]) * 255)).toString(16).padStart(2, "0")
	const green = Math.round((Number.parseFloat(fld[12]) * 255)).toString(16).padStart(2, "0")
	const blue  = Math.round((Number.parseFloat(fld[13]) * 255)).toString(16).padStart(2, "0")
	const color =`#${red}${green}${blue}`.toUpperCase();

	const entry: OneAtomData = {
		symbol: fld[1],
		rCov: Number.parseFloat(fld[3]),
		rVdW: Number.parseFloat(fld[5]),
		maxBonds: Number.parseInt(fld[6], 10),
		color,
	}

	out.push(JSON.stringify(entry))
}

console.log(`[\n${out.join(",\n")}\n]\n`);
