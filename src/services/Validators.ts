import {minLength, object, safeParse, string, array, optional} from "valibot";
import log from "electron-log";
import type {Project} from "@/types";

// {
// 	"graph": [
// 		{"id": "reader", "label": "Reader", "ui": "StructureReaderCtrl", "in": ""},

const projectSchema = object({
	graph: array(object({
		id: string([minLength(1, "Missing id")]),
		label: string([minLength(1, "Missing label")]),
		type: string([minLength(1, "Missing type")]),
		in: string()
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

	const result = safeParse(projectSchema, prj);
	if(result.success) return checkIds(prj);

	for(const issue of result.issues) {
		log.error(`Error from project validator "${issue.validation}": ${issue.message}`);
		if(issue.input) log.error(`Input: ${issue.input as string}`);
		else log.error(`Missing key "${issue.path![0].key as string}" in ${JSON.stringify(issue.path![0].input, undefined, 2)}`);
	}
	return false;
};

const checkIds = (prj: Project): boolean => {

	const ids = new Set<string>();

	for(const entry of prj.graph) {
		if(ids.has(entry.id)) {
			log.error(`Duplicated id "${entry.id}"`);
			return false;
		}
		ids.add(entry.id);
	}

	for(const entry of prj.graph) {
		if(entry.in === "") continue;
		const inputs = entry.in.split(/, */);
		for(const input of inputs) {
			if(ids.has(input)) continue;
			log.error(`Invalid input to "${entry.id}": ${input}`);
			return false;
		}
	}

	return true;
};
