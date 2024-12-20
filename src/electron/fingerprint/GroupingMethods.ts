/**
 * Methods to group the fingerprints.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-19
 */
import type {FingerprintsAccumulator} from "./Accumulator";
import type {DistanceMatrix} from "./Distances";

/** Superclass of all fingerprinting methods */
abstract class GroupingMethod {


    abstract doGrouping(accumulator: FingerprintsAccumulator,
                        distances: DistanceMatrix,
                        threshold: number,
                        margin: number): Set<number>[];

    sparsify(countStructures: number,
             distances: DistanceMatrix,
             threshold: number): number[] {

        // The connection matrix between every structure
        const connection = Array(countStructures*countStructures).fill(0) as number[];

        // Build the connection matrix
        for(let r=0; r < countStructures-1; ++r) {
            for(let c=r+1; c < countStructures; ++c) {

                const oneConnection = distances.get(r, c) < threshold ? 1 : 0;
                connection[c*countStructures+r] = oneConnection;
                connection[r*countStructures+c] = oneConnection;
            }
        }

        return connection;
    }

    depthFirstVisit(idx: number, assigned: boolean[],
                    group: Set<number>, connection: number[], nnodes: number): void {

        // Assign the node to the connected component
        assigned[idx] = true;
        group.add(idx);

        // For each node to which it is connected
        for(let j=0; j < nnodes; ++j) {

            if(assigned[j]) continue;
            if(connection[idx*nnodes+j] !== 0) {
                this.depthFirstVisit(j, assigned, group, connection, nnodes);
            }
        }
    }
}

class PseudoSNNGrouping extends GroupingMethod {

    doGrouping(accumulator: FingerprintsAccumulator,
               distances: DistanceMatrix,
               threshold: number,
               margin: number): Set<number>[] {

        const countStructures = accumulator.selectedSize();

        const connection = this.sparsify(countStructures, distances, threshold);

        // Compute the number of shared NN
        for(let idx1=0; idx1 < countStructures-1; ++idx1) {
            for(let idx2=idx1+1; idx2 < countStructures; ++idx2) {

                // Do nothing if nodes not connected
                if(!connection[idx1*countStructures+idx2]) continue;

                // For all the connections to node1
                for(let j=0; j < countStructures; ++j) {

                    // if j is shared between node-1 and node-2
                    if(j !== idx1 && j !== idx2 &&
                       connection[idx1*countStructures+j] !== 0 &&
                       connection[idx2*countStructures+j] !== 0) {

                        ++connection[idx1*countStructures+idx2];
                        ++connection[idx2*countStructures+idx1];
                    }
                }
            }
        }

        // Now remove connections with only one connection except for standalone pairs
        for(let idx1=0; idx1 < countStructures-1; ++idx1) {
            for(let idx2=idx1+1; idx2 < countStructures; ++idx2) {

                // Do nothing if nodes have none or more than one SNN
                if(connection[idx1*countStructures+idx2] !== 1) continue;

                // Count the number of connections from node1
                let nconn1 = 0;
                for(let j=0; j < countStructures; ++j) {
                    if(connection[idx1*countStructures+j] !== 0) ++nconn1;
                }

                // Count the number of connections from node2
                let nconn2 = 0;
                for(let j=0; j < countStructures; ++j) {
                    if(connection[idx2*countStructures+j] !== 0) ++nconn2;
                }

                // If it is a bridge, break it
                if(nconn1 > 1 && nconn2 > 1) connection[idx1*countStructures+idx2] = 0;
            }
        }

        // If requested remove nodes with less than K shared nearest neighbors
        if(margin > 0) {
            for(let idx1=0; idx1 < countStructures-1; ++idx1) {
                for(let idx2=idx1+1; idx2 < countStructures; ++idx2) {

                    // Do nothing if nodes have none or more than one SNN
                    if(connection[idx1*countStructures+idx2] === 0) continue;
                    if(connection[idx1*countStructures+idx2] < 1+margin) {
                        connection[idx1*countStructures+idx2] = 0;
                    }
                }
            }
        }

        // Make the matrix symmetrical again
        for(let idx1=0; idx1 < countStructures-1; ++idx1) {
            for(let idx2=idx1+1; idx2 < countStructures; ++idx2) {
                connection[idx2*countStructures+idx1] = connection[idx1*countStructures+idx2];
            }
        }

        // Array to keep track of nodes already assigned to a group
        const assigned = Array(countStructures).fill(false) as boolean[];

        // For each node do a DFS to extract the nodes
        const result: Set<number>[] = [];
        for(let idx1=0; idx1 < countStructures; ++idx1) {

            // Skip if already assigned
            if(assigned[idx1]) continue;

            // Start a new group
            const group = new Set<number>();

            // Find the connected component
            this.depthFirstVisit(idx1, assigned, group, connection, countStructures);

            // Insert the new group
            result.push(group);
        }

        return result;
    }
}

abstract class HierarchicalGrouping extends GroupingMethod {

    protected abstract clusterLinkage(): number;
    doGrouping(accumulator: FingerprintsAccumulator,
        distances: DistanceMatrix,
        threshold: number,
        margin: number): Set<number>[] {
            void accumulator;
            void distances;
            void threshold;
            void margin;
            return [];
        }
}

class HierarchicalSingleLinkageGrouping extends HierarchicalGrouping {

    protected clusterLinkage(): number {
        return 0;
    }
}

class HierarchicalCompleteLinkageGrouping extends HierarchicalGrouping {

    protected clusterLinkage(): number {
        return 0;
    }
}


// > Grouping methods list
/** Type of the table of grouping methods */
interface OneGroupingMethod {
    label: string;
    usingEdge: boolean;
    method: GroupingMethod;
}

/** Grouping methods list */
export const groupingMethods: OneGroupingMethod[] = [
    {label: "Pseudo SNN",                               usingEdge: true,
        method: new PseudoSNNGrouping()},
    {label: "Hierarchical grouping (single linkage)",   usingEdge: false,
        method: new HierarchicalSingleLinkageGrouping()},
    {label: "Hierarchical grouping (complete linkage)", usingEdge: false,
        method: new HierarchicalCompleteLinkageGrouping()},
];
