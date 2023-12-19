
import type {ProjectElement} from "@/types";

class GraphManager {

    private static instance: GraphManager;
	private graph: ProjectElement[] = [];

	private constructor() {
		this.graph = [];
	}

	updateGraph(graph: ProjectElement[]): void {
		this.graph = graph;
		void this.graph; // TBD
	}

	// > Access the singleton instance
	/**
	 * Access the singleton instance.
	 *
	 * This is the static method that controls the access to the singleton instance.
	 * This implementation let you subclass the Singleton class while keeping
	 * just one instance of each subclass around.
	 *
	 * @returns The graph manager object
	 */
    static getInstance(): GraphManager {

        if(!GraphManager.instance) {
            GraphManager.instance = new GraphManager();
        }

        return GraphManager.instance;
    }
}

/** Access to the graph manager */
export const gm = GraphManager.getInstance();
