/**
 * Methods to compute the distance between two fingerprints
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-17
 */
import type {StructureReduced} from "./Accumulator";

/** Superclass of all fingerprinting methods */
abstract class DistanceMethod {

    /**
     * Do the fingerprinting
     *
     * @param structure - The structure for which the fingerprint should be computed
     * @returns The various dimensions of the fingerprint
     */
    abstract computeDistance(structure1: StructureReduced, structure2: StructureReduced): number;
}

// > Cosine distance method
class CosineDistance extends DistanceMethod {

    computeDistance(structure1: StructureReduced, structure2: StructureReduced): number {

        const fp1 = structure1.fingerprint;
        const fp2 = structure2.fingerprint;
        const w1 = structure1.weights;
        const w2 = structure2.weights;
        const nsect1 = structure1.countSections;
        const nsect2 = structure2.countSections;
        const sectlen1 = structure1.sectionLength;
        const sectlen2 = structure2.sectionLength;
        let distance = 0;

        // Only one section
        if(nsect1 === 1) {

            let aNorm = 0;
            let bNorm = 0;
            for(let i=0; i < sectlen1; ++i) {

                distance += fp1[i] * fp2[i];
                aNorm    += fp1[i] * fp1[i];
                bNorm    += fp2[i] * fp2[i];
            }

            distance /= Math.sqrt(aNorm*bNorm);
            return (1 - distance)/2;
        }

        // More than one section, created by rdf per atom
        if(w1.length > 0) {

            let aNorm = 0;
            let bNorm = 0;
            for(let sect=0; sect < nsect1; ++sect) {
                for(let i=0; i < sectlen1; ++i) {
                    distance += fp1[i+sectlen1*sect] * fp2[i+sectlen1*sect] * w1[sect] * w2[sect];
                    aNorm    += fp1[i+sectlen1*sect] * fp1[i+sectlen1*sect] * w1[sect] * w1[sect];
                    bNorm    += fp2[i+sectlen1*sect] * fp2[i+sectlen1*sect] * w2[sect] * w2[sect];
                }
            }

            distance /= Math.sqrt(aNorm*bNorm);
            return (1 - distance)/2;
        }

        // Distances per atom
	    // Mark atoms already paired
        const aAtomUsed = Array(nsect1).fill(false) as boolean[];
        const bAtomUsed = Array(nsect2).fill(false) as boolean[];

        // Atoms identities
        const aAtomZ = structure1.atomsZ;
        const bAtomZ = structure2.atomsZ;

        // For each section find the most similar section in the other structure
        for(let i=0; i < nsect1; ++i) {

            // If already paired, skip it
            if(aAtomUsed[i]) continue;

            let currentDistance = Number.MAX_VALUE;
            let currentMinIdx  = -1;

            for(let j=0; j < nsect2; ++j) {

                // If already paired, skip it
                if(bAtomUsed[j]) continue;

                // If different type, skip it
                if(aAtomZ[i] !== bAtomZ[j]) continue;

                // Compute the distance
                let oneDistance = 0.0;
                let aNorm = 0;
                let bNorm = 0;
                for(let k=0; k < sectlen1; ++k) {
                    oneDistance += fp1[i*sectlen1+k] * fp2[j*sectlen2+k];
                    aNorm       += fp1[i*sectlen1+k] * fp1[i*sectlen1+k];
                    bNorm       += fp2[j*sectlen2+k] * fp2[j*sectlen2+k];
                }
                oneDistance /= Math.sqrt(aNorm*bNorm);
                oneDistance = (1 - oneDistance)/2;

                // Find the most similar atom in the other structure
                if(oneDistance < currentDistance) {
                    currentDistance = oneDistance;
                    currentMinIdx  = j;
                }
            }

            // If a pairing has been found
            if(currentMinIdx >= 0) {
                distance += currentDistance;
                aAtomUsed[i] = true;
                bAtomUsed[currentMinIdx] = true;
            }
        }

        return distance/nsect1;
    }
}

// > Euclidean distance method
class EuclideanDistance extends DistanceMethod {

    computeDistance(structure1: StructureReduced, structure2: StructureReduced): number {

        const fp1 = structure1.fingerprint;
        const fp2 = structure2.fingerprint;
        const w1 = structure1.weights;
        const w2 = structure2.weights;
        const nsect1 = structure1.countSections;
        const nsect2 = structure2.countSections;
        const sectlen1 = structure1.sectionLength;
        const sectlen2 = structure2.sectionLength;
        let distance = 0;

        // Only one section
        if(nsect1 === 1) {

            for(let i=0; i < sectlen1; ++i) {

                const dd = fp1[i] - fp2[i];
                distance += dd*dd;
            }

            return Math.sqrt(distance);
        }

        // More than one section
        if(w1.length > 0) {

            for(let k=0; k < nsect1; ++k) {
                let sectionDistance = 0;
                for(let i=0; i < sectlen1; ++i) {

                    const sectionStart = k*sectlen1;
                    const dd = fp1[i+sectionStart] - fp2[i+sectionStart];
                    sectionDistance += dd*dd;
                }
                distance += Math.sqrt(sectionDistance) * w1[k] * w2[k];
            }

            return distance;
        }

        // Distances per atom
	    // Mark atoms already paired
        const aAtomUsed = Array(nsect1).fill(false) as boolean[];
        const bAtomUsed = Array(nsect2).fill(false) as boolean[];

        // Atoms identities
        const aAtomZ = structure1.atomsZ;
        const bAtomZ = structure2.atomsZ;

        // For each section find the most similar section in the other structure
        for(let i=0; i < nsect1; ++i) {

            // If already paired, skip it
            if(aAtomUsed[i]) continue;

            let currentDistance = Number.MAX_VALUE;
            let currentMinIdx  = -1;

            for(let j=0; j < nsect2; ++j) {

                // If already paired, skip it
                if(bAtomUsed[j]) continue;

                // If different type, skip it
                if(aAtomZ[i] !== bAtomZ[j]) continue;

                // Compute the distance
                let oneDistance = 0.0;
                for(let k=0; k < sectlen1; ++k) {
                    const dd = fp1[i*sectlen1+k] - fp2[j*sectlen2+k];
                    oneDistance += dd*dd;
                }
                oneDistance = Math.sqrt(oneDistance);

                // Find the most similar atom in the other structure
                if(oneDistance < currentDistance) {
                    currentDistance = oneDistance;
                    currentMinIdx  = j;
                }
            }

            // If a pairing has been found
            if(currentMinIdx >= 0) {
                distance += currentDistance;
                aAtomUsed[i] = true;
                bAtomUsed[currentMinIdx] = true;
            }
        }

        return distance;
    }
}

// > Minkowski distance method
class MinkowskiDistance extends DistanceMethod {

    computeDistance(structure1: StructureReduced, structure2: StructureReduced): number {

        const fp1 = structure1.fingerprint;
        const fp2 = structure2.fingerprint;
        const w1 = structure1.weights;
        const w2 = structure2.weights;
        const nsect1 = structure1.countSections;
        const nsect2 = structure2.countSections;
        const sectlen1 = structure1.sectionLength;
        const sectlen2 = structure2.sectionLength;
        let distance = 0;

        // Only one section
        if(nsect1 === 1) {

            for(let i=0; i < sectlen1; ++i) {

                let dd = fp1[i] - fp2[i];
                if(dd < 0) dd = -dd;
                distance += Math.cbrt(dd);
            }

            return distance*distance*distance;
        }

        // More than one section
        if(w1.length > 0) {

            for(let k=0; k < nsect1; ++k) {
                let sectionDistance = 0;
                for(let i=0; i < sectlen1; ++i) {

                    const sectionStart = k*sectlen1;
                    let dd = fp1[i+sectionStart] - fp2[i+sectionStart];
                    if(dd < 0) dd = -dd;
                    sectionDistance += Math.cbrt(dd);
                }
                distance += sectionDistance * sectionDistance * sectionDistance * w1[k] * w2[k];
            }

            return distance;
        }

        // Distances per atom
	    // Mark atoms already paired
        const aAtomUsed = Array(nsect1).fill(false) as boolean[];
        const bAtomUsed = Array(nsect2).fill(false) as boolean[];

        // Atoms identities
        const aAtomZ = structure1.atomsZ;
        const bAtomZ = structure2.atomsZ;

        // For each section find the most similar section in the other structure
        for(let i=0; i < nsect1; ++i) {

            // If already paired, skip it
            if(aAtomUsed[i]) continue;

            let currentDistance = Number.MAX_VALUE;
            let currentMinIdx  = -1;

            for(let j=0; j < nsect2; ++j) {

                // If already paired, skip it
                if(bAtomUsed[j]) continue;

                // If different type, skip it
                if(aAtomZ[i] !== bAtomZ[j]) continue;

                // Compute the distance
                let oneDistance = 0.0;
                for(let k=0; k < sectlen1; ++k) {
                    let dd = fp1[i*sectlen1+k] - fp2[j*sectlen2+k];
                    if(dd < 0) dd = -dd;
                    oneDistance += Math.cbrt(dd);
                }
                // eslint-disable-next-line operator-assignment
                oneDistance = oneDistance*oneDistance*oneDistance;

                // Find the most similar atom in the other structure
                if(oneDistance < currentDistance) {
                    currentDistance = oneDistance;
                    currentMinIdx  = j;
                }
            }

            // If a pairing has been found
            if(currentMinIdx >= 0) {
                distance += currentDistance;
                aAtomUsed[i] = true;
                bAtomUsed[currentMinIdx] = true;
            }
        }

        return distance;
    }
}

// > Distance measuring methods list
/** Type of the table of distance measuring methods */
interface MeasuringMethod {
    label: string;
    method: DistanceMethod;
}

/** Distance measuring methods list */
export const measuringMethods: MeasuringMethod[] = [
    {label: "Cosine distance",              method: new CosineDistance()},
    {label: "Euclidean distance",           method: new EuclideanDistance()},
    {label: "Minkowski (p=1/3) distance",   method: new MinkowskiDistance()},
];
