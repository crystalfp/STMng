/**
 * Methods to group the fingerprints.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-19
 */
import type {DistanceMatrix} from "./Distances";

/** Superclass of all grouping methods */
abstract class GroupingMethod {

    /**
     * Compute grouping of structures into groups with similar fingerprints
     *
     * @param countStructures - Total number of selected structures
     * @param distances - Distance matrix between fingerprints
     * @param threshold - Distance threshold to consider two structures in the same group
     * @param margin - Number of structure over one to be considered for node linkage
     */
    abstract doGrouping(countStructures: number,
                        distances: DistanceMatrix,
                        threshold: number,
                        margin: number): Set<number>[];

    /**
     * Compute connection matrix between structure with similar fingerprints
     *
     * @param countStructures - Total number of selected structures
     * @param distances - Distance matrix between fingerprints
     * @param threshold - Distance threshold to consider two structures in the same group
     * @returns Connection matrix between structures
     */
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

    /**
     * Depth first visit of the connection matrix
     *
     * @param idx - Starting structure index
     * @param assigned - Nodes marked as already visited
     * @param group - Set of connected nodes
     * @param connection - Connection matrix between structures
     * @param nnodes - Total number of selected structures
     */
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

    doGrouping(countStructures: number,
               distances: DistanceMatrix,
               threshold: number,
               margin: number): Set<number>[] {

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

    protected abstract clusterDistance(idxi: number[], idxj: number[], distances: DistanceMatrix): number;

    doGrouping(countStructures: number,
               distances: DistanceMatrix,
               threshold: number): Set<number>[] {

        // Initialize root (to point to all)
        const root: number[][] = [];
        for(let i=0; i < countStructures; ++i) root.push([i]);

	    // Iterate till the distance becomes greater than the given threshold
        while(root.length > 1) {

            let mini: number;
            let minj: number;
            let minDistance = Number.POSITIVE_INFINITY;
            const len = root.length;
            for(let ni=0; ni < len-1; ++ni) {
                for(let nj=ni+1; nj < len; ++nj) {
                    const distance = this.clusterDistance(root[ni], root[nj], distances);
                    if(distance < minDistance) {
                        minDistance = distance;
                        mini = ni;
                        minj = nj;
                    }
                }
            }

            // Exit if the threshold has been reached
            if(minDistance > threshold) break;

            // Update the group list. Merge node j at the end of node i
            for(const element of root[minj!]) root[mini!].push(element);

            // Remove merged node
            root.splice(minj!, 1);
        }

        // Load the configuration in the final structure
        const result: Set<number>[] = [];
        for(const node of root) {

            // Start a new group
            const group = new Set<number>();
            for(const ii of node) group.add(ii);
            result.push(group);
        }
        return result;
    }
}

// Exported because it is reused in ReduceDuplicates
export class HierarchicalSingleLinkageGrouping extends HierarchicalGrouping {

    protected clusterDistance(idxi: number[], idxj: number[], distances: DistanceMatrix): number {

        const leni = idxi.length;
        const lenj = idxj.length;

        if(leni === 1 && lenj === 1) {
            return distances.get(idxi[0], idxj[0]);
        }

        let distance = Number.POSITIVE_INFINITY;

        for(let i=0; i < leni; ++i) {
            for(let j=0; j < lenj; ++j) {
                const dd = distances.get(idxi[i], idxj[j]);
                if(dd < distance) distance = dd;
            }
        }

        return distance;
    }
}

class HierarchicalCompleteLinkageGrouping extends HierarchicalGrouping {

    protected clusterDistance(idxi: number[], idxj: number[], distances: DistanceMatrix): number {

        const leni = idxi.length;
        const lenj = idxj.length;

        if(leni === 1 && lenj === 1) {
            return distances.get(idxi[0], idxj[0]);
        }

        let distance = Number.NEGATIVE_INFINITY;

        for(let i=0; i < leni; ++i) {
            for(let j=0; j < lenj; ++j) {
                const dd = distances.get(idxi[i], idxj[j]);
                if(dd > distance) distance = dd;
            }
        }

        return distance;
    }
}


// > Grouping methods list
/** Type of the table of grouping methods */
interface OneGroupingMethod {
    label: string;
    usingMargin: boolean;
    method: GroupingMethod;
}

/** Grouping methods list */
export const groupingMethods: OneGroupingMethod[] = [
    {label: "Pseudo SNN",                               usingMargin: true,
        method: new PseudoSNNGrouping()},
    {label: "Hierarchical grouping (single linkage)",   usingMargin: false,
        method: new HierarchicalSingleLinkageGrouping()},
    {label: "Hierarchical grouping (complete linkage)", usingMargin: false,
        method: new HierarchicalCompleteLinkageGrouping()},
];
