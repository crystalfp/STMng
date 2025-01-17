/**
 * Methods to compute the actual fingerprint.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-11
 */
import {smoothPeak} from "./Smooth";
import {getCellVolume} from "./Helpers";
import {Slab} from "./Slab";
import type {FingerprintingMethodName, FingerprintingMethodResult,
             FingerprintingParameters} from "@/types";
import type {FingerprintsAccumulator, StructureReduced} from "./Accumulator";
import {MapChemicalScale} from "./ChemicalScale";

/** Superclass of all fingerprinting methods */
abstract class FingerprintMethod {

    /**
     * Initialize the fingerprint computation
     *
     * @param params - Parameters for the fingerprint calculation
     * @returns An error message or an empty string on success
     */
    abstract init(params: FingerprintingParameters): string;

    /**
     * Do the fingerprinting
     *
     * @param structure - The structure for which the fingerprint should be computed
     * @returns The various dimensions of the fingerprint
     */
    abstract fingerprinting(structure: StructureReduced): FingerprintingMethodResult;

    /**
     * Finish the fingerprinting computation
     *
     * @param accumulator - The accumulated structures
     * @returns The fingerprint dimension
     */
    finish(accumulator: FingerprintsAccumulator): number {

        const {count, length} = accumulator.getSectionsInfo();
        return count*length;
    }
}

// > Per element RDF method
class PerElementRdfHistogram extends FingerprintMethod {

    private areNanoclusters = false;
    private cutoffDistance = 10;
    private adjustedCutoffForEdgeEffects = 10;
    private binSize = 0.05;
    private peakWidth = 0.02;
    private slab: Slab | undefined;
    private nbins = 10;
    private delta = 1;

    init(params: FingerprintingParameters): string {
        const {areNanoclusters, cutoffDistance, binSize, peakWidth} = params;
        this.areNanoclusters = areNanoclusters;
        this.cutoffDistance = cutoffDistance;
        this.binSize = binSize;
        this.peakWidth = peakWidth;

        // Adjust the cutoff distance for the edge effects
        this.adjustedCutoffForEdgeEffects = this.cutoffDistance + 4 * this.peakWidth;
        this.nbins = Math.ceil(this.adjustedCutoffForEdgeEffects/this.binSize);
        this.delta = this.adjustedCutoffForEdgeEffects/this.nbins;

        // Create the infinite slab
        this.slab = new Slab(this.adjustedCutoffForEdgeEffects, this.areNanoclusters);

        // No error
        return "";
    }

    fingerprinting(structure: StructureReduced): FingerprintingMethodResult {

        // Access the parameters
        const {basis, species, fingerprint, weights} = structure;

        // Compute cell volume
        const cellVolume = getCellVolume(basis, this.areNanoclusters);

        // Initialize counts
        const countSpecies = species.size;
        const countSections = (countSpecies*(countSpecies+1))/2;

        // Initialize the fingerprint histogram
        const fpLength = this.nbins*countSections;
        fingerprint.length = fpLength;
        fingerprint.fill(-1);

        // With the infinite slab compute interatomic distances
        this.slab!.computeInteratomicDistances(structure);

        // Create ordered list of atom z values and list of positions
        const orderedZ = [...species.keys()].sort((a, b) => a-b);
        const atomsIdx = new Map<number, number>();
        let pos = 0;
        for(const atomZ of orderedZ) atomsIdx.set(atomZ, pos++);

        // For each pair of Z values, compute the peak, smooth and accumulate it
        for(const Zi of orderedZ) {

            const Ni = species.get(Zi)!;
            const Pi = atomsIdx.get(Zi)!;

            const distances = this.slab!.getDistancesForZ(Zi);
            for(const [Zj, Rij] of distances) {

                const Nj = species.get(Zj)!;
                const Pj = atomsIdx.get(Zj)!;

                // Compute the peak value Fing
                let fing = this.areNanoclusters ?
                                    1/(Nj*Ni*this.binSize) :
                                    1/(4*Math.PI*Rij*Rij*(Nj/cellVolume)*2*Ni*this.binSize);

                // The components AA, BB, etc. should be counted twice
                if(Zi === Zj) fing *= 2;

                // Compute the section index for this part
                const idxSection = (Pj >= Pi) ?
                                        Pi*countSpecies-(Pi*(Pi+1))/2+Pj :
                                        Pj*countSpecies-(Pj*(Pj+1))/2+Pi;

                // Smooth the peak and accumulate
                smoothPeak(fing, Rij, this.delta, this.nbins, fingerprint,
                           idxSection*this.nbins, this.peakWidth);
            }
        }
        this.slab!.reset();

        // Compute weights
        const len = orderedZ.length;
        weights.length = countSections;

        for(let i=0; i < len; ++i) {
            const Zi = orderedZ[i];
            const Ni = species.get(Zi)!;
            const Pi = atomsIdx.get(Zi)!;
            for(let j=i; j < len; ++j) {
                const Zj = orderedZ[j];
                const Nj = species.get(Zj)!;
                const Pj = atomsIdx.get(Zj)!;
                const idxSection = (Pj >= Pi) ?
                                        Pi*countSpecies-(Pi*(Pi+1))/2+Pj :
                                        Pj*countSpecies-(Pj*(Pj+1))/2+Pi;
                weights[idxSection] = Ni*Nj;
            }
        }

        // Normalize the weights and store them
        let w = 0;
        for(let i=0; i < countSections; ++i) w += weights[i];
        for(let i=0; i < countSections; ++i) weights[i] /= w;

        return {dimension: fpLength, countSections, sectionLength: this.nbins};
    }
}

// > Normalized diffraction method
class NormalizedDiffraction extends FingerprintMethod {

    private adjustedCutoffForEdgeEffects = 10;
    private binSize = 0.05;
    private peakWidth = 0.02;
    private slab: Slab | undefined;
    private nbins = 10;
    private delta = 1;
    protected zmap = (z: number): number => z;

    init(params: FingerprintingParameters): string {

        const {areNanoclusters, cutoffDistance, binSize, peakWidth} = params;

        if(areNanoclusters) return "Not implemented for nanoclusters";

        this.binSize = binSize;
        this.peakWidth = peakWidth;
        this.adjustedCutoffForEdgeEffects = cutoffDistance + 4 * this.peakWidth;

        this.nbins = Math.ceil(this.adjustedCutoffForEdgeEffects/this.binSize);
        this.delta = this.adjustedCutoffForEdgeEffects/this.nbins;

        // Create the infinite slab
        this.slab = new Slab(this.adjustedCutoffForEdgeEffects);

        return "";
    }

    fingerprinting(structure: StructureReduced): FingerprintingMethodResult {

        // Access the parameters
        const {basis, fingerprint, species, atomsZ, weights} = structure;

        // Compute the volume of the unit cell
        const cellVolume = getCellVolume(basis, false);

        // Allocate the histogram (max distance is half max side of every unit cell)
        fingerprint.length = this.nbins;
        fingerprint.fill(0);

        // Create the infinite slab and compute interatomic distances
        this.slab!.computeInteratomicDistances(structure);

        const natoms = atomsZ.length;

        for(let i=0; i < natoms; ++i) {
            const Zi = atomsZ[i];

            const others = this.slab!.getDistancesForZ(Zi);
            for(const [Zj, Rij] of others) {

                // Compute the peak value Fing
                const fing = (Zi*Zj)/(4*Math.PI*Rij*Rij*(natoms/cellVolume)*this.peakWidth);

                // Smooth the peak
    			smoothPeak(fing, Rij, this.delta, this.nbins, fingerprint, 0, this.peakWidth);
            }
        }
        this.slab!.reset();

        // Create list of atom z values and corresponding count
        const listZ = [...species.keys()];
        const listN = [...species.values()];
        const nz = species.size;

        // Compute the adjustment factor
        let adj = 0;
        for(let ii=0; ii < nz; ++ii) {
            for(let jj=0; jj < nz; ++jj) {
                adj += this.zmap(listZ[ii])*this.zmap(listZ[jj])*listN[ii]*listN[jj];
            }
        }
        adj /= natoms;

        // Normalize the histogram
        for(let i=0; i < this.nbins; ++i) {
            fingerprint[i] /= adj;
            fingerprint[i] -= 1;
        }

        // Set the single weight
        weights.length = 1;
        weights[0] = 1;

        return {dimension: this.nbins, countSections: 1, sectionLength: this.nbins};
    }
}


// > Chemical scale spectra method
class ChemicalScaleSpectra extends NormalizedDiffraction {

    protected override zmap = MapChemicalScale;
};

// > Re-centered per element diffraction method
class RecenteredRdfHistogram extends PerElementRdfHistogram {

    private readonly centroid: number[] = [];
    private nloaded = 0;

    override init(params: FingerprintingParameters): string {
        return super.init(params);
    }

    override fingerprinting(structure: StructureReduced): FingerprintingMethodResult {

        const result = super.fingerprinting(structure);

        if(this.nloaded > 0) {
            for(let i=0; i < result.dimension; ++i) this.centroid[i] += structure.fingerprint[i];
            ++this.nloaded;
        }
        else {
            this.centroid.length = result.dimension;
            for(let i=0; i < result.dimension; ++i) this.centroid[i] = structure.fingerprint[i];
            this.nloaded = 1;
        }

        return result;
    }

    override finish(accumulator: FingerprintsAccumulator): number {

        // Compute the centroid
		for(let i=0; i < this.centroid.length; ++i) {
            this.centroid[i] /= this.nloaded;
        }

        // Remove centroid from each fingerprint
		for(const structure of accumulator.iterateSelectedStructures()) {

            const {fingerprint} = structure;

            for(let i=0; i < this.centroid.length; ++i) {
                fingerprint[i] -= this.centroid[i];
            }
        }

        // All done, reset accumulator
        const dimension = this.centroid.length;
        this.centroid.length = 0;
        this.nloaded = 0;

        return dimension;
    }
}

// > Fingerprinting methods list
/** Type of the table of fingerprinting methods */
type FingerprintingMethod = FingerprintingMethodName & {method: FingerprintMethod};

/** Fingerprinting methods list */
export const fingerprintingMethods: FingerprintingMethod[] = [
    {label: "Oganov-Valle fingerprint",				needSizes: true,  forNanoclusters: false,
                                                    method: new NormalizedDiffraction()},
    {label: "Chemical scale weighted fingerprint",	needSizes: true,  forNanoclusters: false,
                                                    method: new ChemicalScaleSpectra()},
    {label: "Per element fingerprint",				needSizes: true,  forNanoclusters: true,
                                                    method: new PerElementRdfHistogram()},
    {label: "Per site fingerprint",                 needSizes: true,  forNanoclusters: true,
                                                    method: new RecenteredRdfHistogram()},
];
