/**
 * Validator for the project file structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {sendAlertMessage} from "./WindowsUtilities";
import type {Project} from "@/types";

import {object as vObject, record as vRecord, pipe as vPipe,
		string as vString, nonEmpty as vNonEmpty, optional as vOptional,
		union as vUnion, number as vNumber, boolean as vBoolean,
		flatten as vFlatten, safeParse} from "valibot";

const projectSchema = vObject({
	graph: vRecord(
				vPipe(vString(), vNonEmpty("Missing id")),
				vObject({
					label: vPipe(vString(), vNonEmpty("Missing label")),
					type: vPipe(vString(), vNonEmpty("Missing type")),
					in: vOptional(vString())
				}),
	),
	currentId: vOptional(vPipe(vString(), vNonEmpty("Invalid currentId"))),
	ui: vOptional(vRecord(
						vPipe(vString(), vNonEmpty("Missing id")),
						vRecord(
							vPipe(vString(), vNonEmpty("Missing id")),
							vUnion([vString(), vNumber(), vBoolean()])
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
	const result = safeParse(projectSchema, prj);

	if(!result.success) {

		const {nested} = vFlatten(result.issues);
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
