
interface OneAtomData {

	/** Element symbol */
	symbol: string;

	/** Covalent radii (in Angstrom). 1.6 if unknown */
	rCov: number;

	/** Van der Waals radii (in Angstrom). 2.0 if unknown */
	rVdW: number;

	/** Maximum bond valence. 6 if unknown */
	maxBonds: number;

	/** IUPAC recommended atomic masses (in amu) */
	mass: number;

	/** Pauling electronegativity. 0.0 if unknown */
	elNeg: number;

	/** Ionization potential (in eV). 0.0 if unknown */
	ionization: number;

	/** Electron affinity (in eV). 0.0 if unknown */
	elAffinity: number;

	/** RGB color for visualization */
	red: number;
	green: number;
	blue: number;

	/** Element name (in English) */
	name: string;
}
import fs from "node:fs";

const filename = "D:/Projects/STMexperimental/public/atom-data.json";
const data = JSON.parse(fs.readFileSync(filename, "utf8")) as OneAtomData[];

//{"symbol": "H",	 "rCov": 0.37, "rVdW": 1.20, "maxBonds": 1, "mass": 1.00794,   "elNeg": 2.20, "ionization": 13.5984, "elAffinity": 0.75420375, "red": 255, "green": 255, "blue": 255, "name": "Hydrogen"},

let out = "";
let first = true;
for(const one of data) {

	out += first ? "[\n" : "},\n";
	first = false;
	out += `{"symbol":"${one.symbol}",`;
	out += `"rCov":${one.rCov.toFixed(2)},`;
	out += `"rVdW":${one.rVdW.toFixed(2)},`;
	out += `"maxBonds":${one.maxBonds.toFixed(0)},`;
	out += `"mass":${one.mass.toFixed(5)},`;
	out += `"elNeg":${one.elNeg.toFixed(2)},`;
	out += `"ionization":${one.ionization.toFixed(5)},`;
	out += `"elAffinity":${one.elAffinity.toFixed(6)},`;

	const rs = one.red.toString(16).toUpperCase().padStart(2, "0");
	const gs = one.green.toString(16).toUpperCase().padStart(2, "0");
	const bs = one.blue.toString(16).toUpperCase().padStart(2, "0");

	out += `"color":"#${rs}${gs}${bs}",`;
	out += `"name":"${one.name}"`;
}

fs.writeFileSync("atom-data.json", out + "}\n]\n", "utf8");
