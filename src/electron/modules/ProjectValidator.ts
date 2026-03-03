/**
 * Validator for the project file structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {sendAlertToClient} from "./ToClient";
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
					in: vOptional(vString()),
					x: vOptional(vNumber()),
					y: vOptional(vNumber())
				}),
	),
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
		sendAlertToClient(errorMessage);

		return false;
	}

	// Check IDs
	if(!checkIds(prj)) return false;

	// Check for the presence of cycles
	return checkCycles(prj);
};

// > Check node IDs in the project
// __proto__ added for security
const reservedIds = new Set<string>(["SYSTEM", "PROJECT", "PREFERENCES",
									 "WINDOW", "LOGFILE", "__proto__"]);

/**
 * Check node IDs in the project
 *
 * @param prj - The project
 * @returns True if there are no problems with the id of the modules
 */
const checkIds = (prj: Project): boolean => {

	const ids = new Set<string>();

	for(const id in prj.graph) {

		if(reservedIds.has(id)) {
			sendAlertToClient(`Reserved id "${id}" cannot be used`);
			return false;
		}

		if(ids.has(id)) {
			sendAlertToClient(`Duplicated id "${id}"`);
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
			sendAlertToClient(`Invalid input to node "${id}": ${input}`);
			return false;
		}
	}

	return true;
};

/** Colors for the graph nodes */
const WHITE = 0;
const GRAY  = 1;
const BLACK = 2;

/**
 * Result of the loop detector
 * @notExported
 */
interface LoopDetectionResult {
	/** If the graph has loops */
	hasLoop: boolean;
	/** Nodes composing the loop */
	loop?: string[];
}

/**
 * Detects loops in a directed graph using a graph coloring algorithm.
 * Algorithm from: https://github.com/dexcodeinc/graph_algorithm.js/blob/master/graph_algorithm.js
 *
 * @param vertices - An array of vertices names
 * @param edges - An array of edges. Each edge is represented as an array of length 2,
 *    specifying the source and destination vertices. Format: [source, destination].
 * @returns An object indicating whether a loop is present and, if so, the vertices
 *    forming the loop. The return value has the following structure:
 *     - hasLoop: A boolean value indicating whether a loop is present in the graph.
 *     - loop: An array of vertices forming the loop, listed in the order they are encountered
 *       during traversal.
 */
const hasLoop = (vertices: string[], edges: string[][]): LoopDetectionResult => {

	const colors: Record<string, number> = {};
	const path: string[] = [];

	// Initialize colors to white
	for(const vertex of vertices) {
		colors[vertex] = WHITE;
	}

	// For all vertices, do DFS traversal
	for(const vertex of vertices) {

		if(colors[vertex] === WHITE) {
			const result = hasLoopDFS(edges, colors, path, vertex);

			if(result.hasLoop) {
				return result;
			}
		}
	}

	return {
		hasLoop: false
	};
};

/**
 * Depth first traverse of the graph
 *
 * @param edges - An array of edges.
 * @param colors - List of vertices colors
 * @param path - Traversed path
 * @param vertex - Vertex from which the DFS should start
 * @returns An object indicating whether a loop is present and, if so, the vertices forming the loop
 */
const hasLoopDFS = (edges: string[][], colors: Record<string, number>,
					path: string[], vertex: string): LoopDetectionResult => {

	colors[vertex] = GRAY;
	path.push(vertex);

	const adjacentEdges: string[][] = [];

	for(const edge of edges) {

		if(edge[0] === vertex) {
			adjacentEdges.push(edge);
		}
	}

	for(const edge of adjacentEdges) {

		const adjVertex = edge[1];

		if(colors[adjVertex] === GRAY) {
			const loop = path.slice(path.indexOf(adjVertex));
			return {
				hasLoop: true,
				loop: loop
			};
		}

		if(colors[adjVertex] === WHITE) {
			const result = hasLoopDFS(edges, colors, path, adjVertex);
			if(result.hasLoop) {
				return result;
			}
		}
	}

	colors[vertex] = BLACK;
	path.pop();

	return {hasLoop: false};
};

/**
 * Check node IDs in the project
 *
 * @param prj - The project
 * @returns True if there are no problems with the id of the modules
 */
const checkCycles = (prj: Project): boolean => {

	const {graph} = prj;
	const vertices: string[] = [];
	const edges: string[][] = [];

	for(const node in graph) {
		vertices.push(node);
		if(graph[node].in) {
			const inputs = graph[node].in.replaceAll(" ", "").split(",");
			for(const input of inputs) {
				edges.push([input, node]);
			}
		}
	}

	const result = hasLoop(vertices, edges);

	if(result.hasLoop) {

		sendAlertToClient(`Cycle detected in nodes: ${result.loop!.join(", ")}`);

		return false;
	}

	return true;
};
