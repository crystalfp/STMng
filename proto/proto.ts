import {ReaderPOSCAR} from "../src/electron/readers/ReadPOSCAR.ts";
import {AflowPrototypeMatcher} from "./AflowPrototypeMatcher.ts";
const reader = new ReaderPOSCAR();
const matcher = new AflowPrototypeMatcher();

reader.readStructure("GaAs.vasp")
.then((structure) => {

	const prototypes = matcher.getPrototypes(structure[0]);

	if(prototypes.length > 0) {
		let index = 1;
		console.log("Matched Prototype(s):");
		for(const proto of prototypes) {
			console.log(`Prototype ${index}:`);
			console.log(`  SNL: ${proto.snl}`);
			console.log("  Tags:");
			for(const [key, value] of Object.entries(proto.tags)) {
				console.log(`    ${key}: ${value}`);
			}
			++index;
		}
	}
	else {
		console.log("No matching prototypes found.");
	}
})
.catch((error) => {
	console.error("Error reading structure:", error);
});
