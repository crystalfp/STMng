import {minLength, object, safeParse, string, array, optional} from "valibot";
import type {Project} from "@/types";
import {showErrorNotification} from "@/services/ErrorNotification";

// {
// 	"graph": [
// 		{"id": "reader", "label": "Reader", "ui": "StructureReaderCtrl", "in": ""},

const projectSchema = object({
	graph: array(object({
		id: string([minLength(1, "Missing id")]),
		label: string([minLength(1, "Missing label")]),
		type: string([minLength(1, "Missing type")]),
		in: optional(string())
	})),
	currentId: optional(string([minLength(1, "Invalid currentId")]))
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

	// Check the IDs
	return checkIds(prj);
};

/**
 * Check id in the project
 *
 * @param prj - The project
 * @returns True if there are no problems with the id of the modules
 */
const checkIds = (prj: Project): boolean => {

	const ids = new Set<string>();

	for(const entry of prj.graph) {
		if(ids.has(entry.id)) {
			showErrorNotification(`Duplicated id "${entry.id}"`);
			return false;
		}
		ids.add(entry.id);
	}

	for(const entry of prj.graph) {
		if(!entry.in) continue;
		const inputs = entry.in.split(/, */);
		for(const input of inputs) {
			if(ids.has(input)) continue;
			showErrorNotification(`Invalid input to "${entry.id}": ${input}`);
			return false;
		}
	}

	return true;
};
