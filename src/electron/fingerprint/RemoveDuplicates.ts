/**
 * Remove duplicated structures with distances between them less than threshold.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-02-19
 */
import type {FingerprintsAccumulator, StructureReduced} from "./Accumulator";
import type {Distances} from "./Distances";
import {HierarchicalSingleLinkageGrouping} from "./GroupingMethods";
// import {HierarchicalCompleteLinkageGrouping} from "./GroupingMethods";

/**
 * Puts enabled true to the lowest energy structure per group
 *
 * @param enabled - If the reduction should be done
 * @param accumulator - The accumulated structures
 * @param distances - The pair distance object
 * @param threshold - The distance threshold (absolute)
 * @returns The number of points removed or -1 if no point removed
 */
export const removeDuplicatePoints = (enabled: boolean,
                                      accumulator: FingerprintsAccumulator,
                                      distances: Distances,
                                      threshold: number): number => {

    // If reduction not enabled, set enabled on all structures
    if(!enabled) {
        accumulator.setEnableStatus(true);
        return -1;
    }

    // Access useful variables
    const distanceMatrix = distances.getDistanceMatrix();
    const countStructures = accumulator.selectedSize();
    if(countStructures === 0 || distanceMatrix.matrixSize() === 0)  {
        accumulator.setEnableStatus(true);
        return -1;
    }
    const hasEnergies = accumulator.accumulatedHaveEnergies();

    // Do the grouping
    const grouper = new HierarchicalSingleLinkageGrouping();
    // const grouper = new HierarchicalCompleteLinkageGrouping();
    const groups = grouper.doGrouping(countStructures, distanceMatrix, threshold);
    const countGroups = groups.length;
    if(countGroups === 0) {
        accumulator.setEnableStatus(true);
        return -1;
    }

    // Make an index of the structures
    const structures: StructureReduced[] = [];
    for(const structure of accumulator.iterateSelectedStructures()) {
        structures.push(structure);
    }

    // Start with nothing enabled
    accumulator.setEnableStatus(false);
    let countEnabled = 0;

    // For each group
    for(let gi=0; gi < countGroups; ++gi) {

        // The indices of the structures in the group
        const indices = [...groups[gi]];

        // If group size is one, nothing to remove, enable the only member
        if(indices.length === 1) {

            const idx = indices[0];
            structures[idx].enabled = true;
        }
        // Else if there are energies find the lowest energy point per group
        else if(hasEnergies) {

            // Find minimum energy
            let minEnergy = Number.POSITIVE_INFINITY;
            let minEnergyIdx = 0;
            for(const i of indices) {

                if(structures[i].energy! < minEnergy) {
                    minEnergy = structures[i].energy!;
                    minEnergyIdx = i;
                }
            }
            structures[minEnergyIdx].enabled = true;
        }
        // Else finds the most central point using
        // the sum of distances (geometric median)
        else {

            let medianDistance = Number.POSITIVE_INFINITY;
            let medianDistanceIdx = 0;
            for(const i of indices) {

                let totalDistance = 0;
                for(const j of indices) {

                    if(i === j) continue;
                    totalDistance += distanceMatrix.get(i, j);
                }
                if(totalDistance < medianDistance) {
                    medianDistance = totalDistance;
                    medianDistanceIdx = i;
                }
            }
            structures[medianDistanceIdx].enabled = true;
        }
        ++countEnabled;
    }

    return countStructures-countEnabled;
};
