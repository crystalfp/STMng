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


const massAll: number[] = [];
const reader = createInterface(fs.createReadStream("element.txt", {encoding: "utf8"}));
for await (const lineRaw of reader) {

	const line = lineRaw.replace(/#.+$/, "").trim();
	if(line === "") continue;
	const fld = line.trim().split("\t")

	const z = Number.parseInt(fld[0])
	const mass = Number.parseFloat(fld[7])

	massAll[z] = mass;
}


interface Data {
	symbol: string;
	rCov: number;
	rVdW: number;
	maxBonds: number;
	color: string;
	bondStrength: number;
	mass?: number;
}

const data = JSON.parse(fs.readFileSync("D:/Projects/STMng/save/atom-data.json", "utf8")) as Data;

for(let z=0; z < data.length; ++z) {

	data[z].mass = massAll[z];
}

const str = JSON.stringify(data).replaceAll("},", "},\n").replace("[{", "[\n{").replace("}]", "}\n]\n")

fs.writeFileSync("D:/Projects/STMng/public/atom-data.json", str, "utf8")
