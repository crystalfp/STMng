// From here: https://github.com/dexcodeinc/graph_algorithm.js/blob/master/graph_algorithm.js
const WHITE = 0;
const GRAY = 1;
const BLACK = 2;

interface LoopDetectionResult {
	hasLoop: boolean;
	loop?: string[];
}

	/**
	 * Detects loops in a directed graph using a graph coloring algorithm.
	 *
	 * @param {Array} vertices - An array of vertices. Each vertex can be either
	 *    an integer or a string.
	 * @param {Array} edges - An array of edges. Each edge is represented as an array of length 2,
	 *    specifying the source and destination vertices. Format: [source, destination].
	 *
	 * @returns {Object} An object indicating whether a loop is present and, if so, the vertices
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
				const result = hasLoopDFS(vertices, edges, colors, path, vertex);

				if(result.hasLoop) {
					return result;
				}
			}
		}

		return {
			hasLoop: false
		};
	};

	const hasLoopDFS = (vertices: string[], edges: string[][], colors: Record<string, number>,
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
				const result = hasLoopDFS(vertices, edges, colors, path, adjVertex);
				if(result.hasLoop) {
					return result;
				}
			}
		}

		colors[vertex] = BLACK;
		path.pop();

		return {hasLoop: false};
	};

const vertices = ["a", "b", "c", "d", "e"];
const edges1 = [["a", "b"], ["a", "c"], ["b", "c"], ["c", "e"], ["e", "b"]];

console.log(hasLoop(vertices, edges1));
const edges2 = [["a", "b"], ["a", "c"], ["b", "c"], ["c", "e"]];

console.log(hasLoop(vertices, edges2));
