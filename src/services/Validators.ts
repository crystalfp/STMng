/**
 * Validator for the project file structure.
 *
 * @packageDocumentation
 */
import {minLength, object, safeParse, string, optional,
		record, union, number, boolean} from "valibot";
import type {Project} from "@/types";
import {showErrorNotification} from "@/services/ErrorNotification";
import {sb} from "@/services/Switchboard";

// {
// "graph": {
// 	"reader": 	 {"label": "Reader", 	"type": "structure-reader"},
// 	"findsymm":  {"label": "Find symm", "type": "find-symmetries",  "in": "reader"},

const projectSchema = object({
	graph: record(string([minLength(1, "Missing id")]), object({
			label: string([minLength(1, "Missing label")]),
			type: string([minLength(1, "Missing type")]),
			in: optional(string())
		}),
	),
	currentId: optional(string([minLength(1, "Invalid currentId")])),
	ui: optional(record(string([minLength(1, "Missing id")]),
						record(string([minLength(1, "Missing id")]),
							   union([string(), number(), boolean()]))
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
	const result = safeParse(projectSchema, prj);

	if(!result.success) {

		for(const issue of result.issues) {
			showErrorNotification(`Error from project validator "${issue.reason}": ${issue.message}`);
			if(issue.input) showErrorNotification(`Input: ${issue.input as string}`);
			else showErrorNotification(`Missing key "${issue.path![0].key as string}" in ${JSON.stringify(issue.path![0].input, undefined, 2)}`);
		}
		return false;
	}

	// Check IDs and types
	return checkIds(prj) && checkTypes(prj);
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
		if(ids.has(id)) {
			showErrorNotification(`Duplicated id "${id}"`);
			return false;
		}
		ids.add(id);
	}

	for(const id in prj.graph) {

		const entry = prj.graph[id];
		if(!entry.in) continue;
		const inputs = entry.in.split(/, */);
		for(const input of inputs) {
			if(ids.has(input)) continue;
			showErrorNotification(`Invalid input to node "${id}": ${input}`);
			return false;
		}
	}

	return true;
};

// > Verify node types
/**
 * Verify node types
 *
 * @param prj - The project under check
 * @returns True if the types of the nodes are valid
 */
const checkTypes = (prj: Project): boolean => {

	for(const id in prj.graph) {

		const {type} = prj.graph[id];
		if(!sb.checkType(type)) {

			showErrorNotification(`Node type "${type}" does not exist`);
			return false;
		}
	}
	return true;
};
