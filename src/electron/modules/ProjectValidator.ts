/**
 * Validator for the project file structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import * as v from "valibot";
import {sendAlertMessage} from "./WindowsUtilities";
import type {Project} from "@/types";

// {
// "graph": {
// 	"reader": 	{"label": "Reader", 	"type": "structure-reader"},
//  "symmetry": {"label": "Symmetries", "type": "compute-symmetries", "in": "reader"},

const projectSchema = v.object({
	graph: v.record(
				v.pipe(v.string(), v.nonEmpty("Missing id")),
				v.object({
					label: v.pipe(v.string(), v.nonEmpty("Missing label")),
					type: v.pipe(v.string(), v.nonEmpty("Missing type")),
					in: v.optional(v.string())
				}),
	),
	currentId: v.optional(v.pipe(v.string(), v.nonEmpty("Invalid currentId"))),
	ui: v.optional(v.record(
						v.pipe(v.string(), v.nonEmpty("Missing id")),
						v.record(
							v.pipe(v.string(), v.nonEmpty("Missing id")),
							v.union([v.string(), v.number(), v.boolean()])
						)
	))
});

// > Validate project structure on disk
/**
 * Validate project structure on disk
 *
 * @param prj - The project on disk to validate
 * @returns True if it is a valid project
 */
export const projectIsValid = (prj: Project): boolean => {

	if(!prj) return false;

	// Check against the schema
	const result = v.safeParse(projectSchema, prj);

	if(!result.success) {

		const {nested} = v.flatten(result.issues);
		let errorMessage = "Error from project validator\n";
		for(const entry in nested) {
			errorMessage += `  ${entry}: "${nested[entry]?.join("; ")}"\n`;
		}
		sendAlertMessage(errorMessage);

		return false;
	}

	// Check IDs
	return checkIds(prj);
};

// > Check node IDs in the project
/**
 * Check node IDs in the project
 *
 * @param prj - The project
 * @returns True if there are no problems with the id of the modules
 */
const checkIds = (prj: Project): boolean => {

	const ids = new Set<string>();

	for(const id in prj.graph) {

		if(["SYSTEM", "PROJECT", "PREFERENCES", "WINDOW", "LOGFILE"].includes(id)) {
			sendAlertMessage(`Reserved id "${id}" cannot be used`);
			return false;
		}

		if(ids.has(id)) {
			sendAlertMessage(`Duplicated id "${id}"`);
			return false;
		}
		ids.add(id);
	}

	for(const id in prj.graph) {

		const entry = prj.graph[id];
		if(!entry.in) continue;
		const inputs = entry.in.replaceAll(" ", "").split(",");

		for(const input of inputs) {
			if(ids.has(input)) continue;
			sendAlertMessage(`Invalid input to node "${id}": ${input}`);
			return false;
		}
	}

	return true;
};
