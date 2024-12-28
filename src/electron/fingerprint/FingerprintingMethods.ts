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
import {MapChemScale, MapMendeleev} from "./MapPettifor";

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
                smoothPeak(fing, Rij, this.delta, this.nbins, fingerprint, idxSection*this.nbins, this.peakWidth);
            }
        }

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

// > Mendeleev spectra method
class MendeleevSpectra extends NormalizedDiffraction {

    protected override zmap = MapMendeleev;
};

// > Chemical scale spectra method
class ChemicalScaleSpectra extends NormalizedDiffraction {

    protected override zmap = MapChemScale;
};

// > Distances per atom method
class DistancesPerAtom extends FingerprintMethod {

    private slab: Slab | undefined;

    init(): string {

        // Create the slab limited to the unit cell and by atoms, not species
        this.slab = new Slab(0, true, true);

        return "";
    }

    protected distancePerAtomFingerprinting(structure: StructureReduced): number {

        // Compute interatomic distances inside the unit cell
        this.slab!.computeInteratomicDistances(structure);

        const {atomsZ, fingerprint} = structure;

        const natoms = atomsZ.length;
        let sectionLength = 0;
        for(let idx=0; idx < natoms; ++idx) {
            const countDistances = this.slab!.getDistancesForZ(idx).length;
            if(countDistances > sectionLength) sectionLength = countDistances;
        }
        fingerprint.length = natoms*sectionLength;
        fingerprint.fill(0);

        let section = 0;
        for(let idx=0; idx < natoms; ++idx) {
            const distances = this.slab!.getDistancesForZ(idx).toSorted((a, b) => b[1]-a[1]);
            let i = 0;
            for(const distance of distances) {
                fingerprint[section*sectionLength+i] = distance[1];
                ++i;
            }
            ++section;
        }
        return sectionLength;
    }

    fingerprinting(structure: StructureReduced): FingerprintingMethodResult {

        const sectionLength = this.distancePerAtomFingerprinting(structure);
        const {atomsZ, weights} = structure;

        const natoms = atomsZ.length;

        // No weights, distance will be computed pairing atoms
        weights.length = 0;

        return {dimension: natoms*sectionLength, countSections: natoms, sectionLength};
    }
}

// > Merged distances method
class MergedDistances extends DistancesPerAtom {

    override fingerprinting(structure: StructureReduced): FingerprintingMethodResult {

        const sectionLength = this.distancePerAtomFingerprinting(structure);
        const {atomsZ, weights, fingerprint} = structure;

        const natoms = atomsZ.length;

        fingerprint.sort((a, b) => b-a);

        // Set equal weights
        weights.length = 1;
        weights[0] = 1;

        return {dimension: natoms*sectionLength, countSections: 1, sectionLength: natoms*sectionLength};
    }
}

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

// > Trimmed per element diffraction method
class TrimmedRdfHistogram extends PerElementRdfHistogram {

    private nloaded = 0;
    private readonly minValues: number[] = [];
    private readonly maxValues: number[] = [];

    override init(params: FingerprintingParameters): string {
        return super.init(params);
    }

    override fingerprinting(structure: StructureReduced): FingerprintingMethodResult {

        const result = super.fingerprinting(structure);

        const {fingerprint} = structure;

        if(this.nloaded > 0) {

            for(let i=0; i < result.dimension; ++i) {

                if(fingerprint[i] < this.minValues[i]) this.minValues[i] = fingerprint[i];
                if(fingerprint[i] > this.maxValues[i]) this.maxValues[i] = fingerprint[i];
            }
            ++this.nloaded;
        }
        else {
            this.minValues.length = result.dimension;
            this.maxValues.length = result.dimension;
            for(let i=0; i < result.dimension; ++i) {

                this.minValues[i] = this.maxValues[i] = fingerprint[i];
            }
            this.nloaded = 1;
        }

        return result;
    }

    override finish(accumulator: FingerprintsAccumulator): number {

        const nvalues = this.minValues.length;
        const dimIncluded: boolean[] = Array(nvalues) as boolean[];
        const TOL = 1e-3;

        for(let i=0; i < nvalues; ++i) {
			const perc = (this.maxValues[i]-this.minValues[i])/(this.maxValues[i]+this.minValues[i]);
			dimIncluded[i] = (perc > TOL || perc < -TOL);
        }

        let dimension = 0;
		for(const structure of accumulator.iterateSelectedStructures()) {

            const {fingerprint} = structure;

            const resultingFingerprint: number[] = [];

            for(let i=0; i < nvalues; ++i) {
                if(dimIncluded[i]) resultingFingerprint.push(fingerprint[i]);
            }

            fingerprint.length = 0;
            for(const fp of resultingFingerprint) fingerprint.push(fp);
            dimension = fingerprint.length;
        }

        // Reset working arrays
        this.minValues.length = 0;
        this.maxValues.length = 0;
        this.nloaded = 0;
        return dimension;
    }
}

// > Fingerprinting methods list
/** Type of the table of fingerprinting methods */
type FingerprintingMethod = FingerprintingMethodName & {method: FingerprintMethod};

/** Fingerprinting methods list */
export const fingerprintingMethods: FingerprintingMethod[] = [
    {label: "Normalized diffraction",				needSizes: true,  forNanoclusters: false,
        method: new NormalizedDiffraction()},
    {label: "Mendeleev spectra",					needSizes: true,  forNanoclusters: false,
        method: new MendeleevSpectra()},
    {label: "Chemical scale spectra",				needSizes: true,  forNanoclusters: false,
        method: new ChemicalScaleSpectra()},
    {label: "Per element diffraction",				needSizes: true,  forNanoclusters: true,
        method: new PerElementRdfHistogram()},
    {label: "Distances per atom",					needSizes: false, forNanoclusters: false,
        method: new DistancesPerAtom()},
    {label: "Merged distances",						needSizes: false, forNanoclusters: false,
        method: new MergedDistances()},
    {label: "Re-centered per element diffraction",	needSizes: true,  forNanoclusters: true,
        method: new RecenteredRdfHistogram()},
    {label: "Trimmed per element diffraction",		needSizes: false, forNanoclusters: true,
        method: new TrimmedRdfHistogram()},
];
