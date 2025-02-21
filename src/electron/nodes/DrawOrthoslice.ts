/**
 * Compute an orthoslice of the volumetric data.
 * If requested show also isolines on it.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import {NodeCore} from "../modules/NodeCore";
import {sendIsoOrthoToClient} from "../modules/ToClient";
import {Isolines} from "../modules/Isolines";
import {getValueLimits} from "../modules/Helpers";
import type {Structure, CtrlParams,
             ChannelDefinition, PositionType, BasisType} from "@/types";

export class DrawOrthoslice extends NodeCore {

	private structure: Structure | undefined;
	private dataset = 0;
	private axis = 0;
	private plane = 0;
	private showOrthoslice = false;
	private countDatasets = 0;
	private maxPlane = 0;
    private colormapName = "rainbow";
    private limitLow = -10;
    private limitHigh = 10;
    private valueRange: [number, number] = [-10, 10];
    private useColorClasses = false;
    private colorClasses = 5;
    private showIsolines = false;
    private isoValue = 0;
    private colorIsolines = false;
	private isolineValues: number[] = [];
	private isolinesVertices: number[][] = [];
	private readonly orthoValues: number[] = [];
	private readonly orthoVertices: number[] = [];
	private readonly orthoIndices: number[] = [];

	private readonly channels: ChannelDefinition[] = [
		{name: "init",      type: "invoke", callback: this.channelInit.bind(this)},
		{name: "change",    type: "send",   callback: this.channelChange.bind(this)},
		{name: "show",      type: "send",   callback: this.channelShow.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	override fromPreviousNode(data: Structure): void {

		this.structure = data;
		const countDatasets = this.structure.volume?.length ?? 0;

		if(countDatasets === 0) {

			this.dataset = 0;
			this.axis = 0;
			this.plane = 0;
			this.countDatasets = 0;
			this.maxPlane = 0;
			this.valueRange = [-10, 10];
			this.limitLow = -10;
			this.limitHigh = 10;

			sendIsoOrthoToClient(this.id, "computed",
                                {
                                    vertices: [],
                                    indices: [],
                                    values: [],
                                    isolineVertices: [],
                                    isolineValues: [],
                                    params: {
                                        countDatasets: this.countDatasets,
                                        maxPlane: this.maxPlane,
                                        valueMin: this.valueRange[0],
                                        valueMax: this.valueRange[1],
                                        limitLow: this.limitLow,
                                        limitHigh: this.limitHigh,
								    }
                                });
		}
		else {
			this.dataset = 0;
			this.plane = 0;
			this.countDatasets = countDatasets;

			// The number of planes is one more the sides. The last plane is equal to the first one
			this.maxPlane = this.structure.volume[0].sides[this.axis];

			this.valueRange = getValueLimits(this.structure, this.dataset);
			this.limitLow = this.valueRange[0];
			this.limitHigh = this.valueRange[1];

            // Check if the plane should be created
            if((this.showOrthoslice || this.showIsolines) &&
                this.structure.volume[this.dataset].values.length > 0) {

                this.computeOrthoslice();
            }

			sendIsoOrthoToClient(this.id, "computed",
                                {
                                    vertices: this.orthoVertices,
                                    indices: this.orthoIndices,
                                    values: this.orthoValues,
                                    isolineVertices: this.isolinesVertices,
                                    isolineValues: this.isolineValues,
                                    params: {
                                        countDatasets: this.countDatasets,
                                        maxPlane: this.maxPlane,
                                        valueMin: this.valueRange[0],
                                        valueMax: this.valueRange[1],
                                        limitLow: this.limitLow,
                                        limitHigh: this.limitHigh,
								    }
                                });
		}
	}

	// > Load/save status
	saveStatus(): string {

        const statusToSave = {
			dataset: this.dataset,
			axis: this.axis,
			plane: this.plane,
			showOrthoslice: this.showOrthoslice,
			colormapName: this.colormapName,
			useColorClasses: this.useColorClasses,
			colorClasses: this.colorClasses,
			showIsolines: this.showIsolines,
			isoValue: this.isoValue,
			colorIsolines: this.colorIsolines
		};
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

        this.dataset = params.dataset as number ?? 0;
        this.axis = params.axis as number ?? 0;
        this.plane = params.plane as number ?? 0;
		this.showOrthoslice = params.showOrthoslice as boolean ?? false;
        this.colormapName = params.colormapName as string ?? "rainbow";
        this.useColorClasses = params.useColorClasses as boolean ?? false;
        this.colorClasses = params.colorClasses as number ?? 5;
        this.showIsolines = params.showIsolines as boolean ?? false;
        this.isoValue = params.isoValue as number ?? 0;
        this.colorIsolines = params.colorIsolines as boolean ?? false;
	}

    /**
     * Change grid vertice fraction to absolute coordinates
     *
     * @param fx - Fraction of the unit cell along x
     * @param fy - Fraction of the unit cell along y
     * @param fz - Fraction of the unit cell along z
     * @param basis - The unit cell basis
     * @param origin - Origin of the unit cell
     * @param vertices - Where the point coordinates will be put
     */
    private fractionToAbsolute(fx: number, fy: number, fz: number,
                               basis: BasisType, origin: PositionType,
                               vertices: number[]): void {

        vertices.push(
            fx*basis[0] + fy*basis[3] + fz*basis[6] + origin[0],
            fx*basis[1] + fy*basis[4] + fz*basis[7] + origin[1],
            fx*basis[2] + fy*basis[5] + fz*basis[8] + origin[2]
        );
    }

    /**
     * Compute the triangles vertices indices
     *
     * @param fastSide - The index that varies faster than the other
     * @param slowSide - The index that varies slower than the other
     * @param indices - Where the computed triangles vertices indices goes
     */
    private generateIndices(fastSide: number, slowSide: number, indices: number[]): void {

        for(let vv=0; vv < slowSide; ++vv) {
            for(let uu=0; uu < fastSide; ++uu) {

                // cc---dd
                //  | / |
                // aa---bb
                const aa = (vv*(fastSide+1))+uu;
                const bb = aa+1;
                const cc = aa+fastSide+1;
                const dd = cc+1;

                indices.push(bb, aa, dd, aa, cc, dd);
            }
        }
    }

    /**
     * Map value to color
     *
     * @param nx - Grid node index along x
     * @param ny - Grid node index along y
     * @param nz - Grid node index along z
     * @param values - The grid of values
     * @param sides - The sides of the grid
     * @returns The RGB color of the point
     */
    private getValue(nx: number, ny: number, nz: number,
                     values: number[], sides: PositionType): number {

        if(nx === sides[0]) nx = 0;
        if(ny === sides[1]) ny = 0;
        if(nz === sides[2]) nz = 0;

        return values[nx + (ny + nz*sides[1])*sides[0]];
    }

    /**
     * Compute the orthoslice and the isolines for the given parameters
     */
	private computeOrthoslice(): void {

        // Access the needed values
        const {basis, origin} = this.structure!.crystal;
        const {sides, values} = this.structure!.volume[this.dataset];

        // Create the isolines values
        if(this.useColorClasses) {
            const delta = (this.limitHigh - this.limitLow) / this.colorClasses;
            this.isolineValues = [this.limitLow];
            for(let i=1; i < this.colorClasses; ++i) this.isolineValues.push(this.limitLow + i*delta);
            this.isolineValues.push(this.limitHigh);
        }
        else this.isolineValues = [this.isoValue];

        // Initialize the isolines
        const isolines = new Isolines(values, sides, this.isolineValues);

        // Create the orthoslice depending on the axis requested
        let fixed;
        this.orthoIndices.length = 0;
        this.orthoVertices.length = 0;
        this.orthoValues.length = 0;
        switch(this.axis) {

            case 0: // X
                fixed = this.plane / sides[0];
                for(let ny=0; ny <= sides[1]; ++ny) {
                    for(let nz=0; nz <= sides[2]; ++nz) {
                        this.fractionToAbsolute(fixed, ny/sides[1], nz/sides[2],
                                                basis, origin, this.orthoVertices);
                        const co = this.getValue(this.plane, ny, nz, values, sides);
						this.orthoValues.push(co);
                    }
                }
                this.generateIndices(sides[2], sides[1], this.orthoIndices);
                isolines.computeIsolines(2, 1, 0, this.plane, this.orthoVertices);
                break;

            case 1: // Y
                fixed = this.plane / sides[1];
                for(let nx=0; nx <= sides[0]; ++nx) {
                    for(let nz=0; nz <= sides[2]; ++nz) {
                        this.fractionToAbsolute(nx/sides[0], fixed, nz/sides[2],
                                                basis, origin, this.orthoVertices);
                        const co = this.getValue(nx, this.plane, nz, values, sides);
						this.orthoValues.push(co);
                    }
                }
                this.generateIndices(sides[2], sides[0], this.orthoIndices);
                isolines.computeIsolines(2, 0, 1, this.plane, this.orthoVertices);
                break;

            case 2: // Z
                fixed = this.plane / sides[2];
                for(let nx=0; nx <= sides[0]; ++nx) {
                    for(let ny=0; ny <= sides[1]; ++ny) {
                        this.fractionToAbsolute(nx/sides[0], ny/sides[1], fixed,
                                                basis, origin, this.orthoVertices);
                        const co = this.getValue(nx, ny, this.plane, values, sides);
						this.orthoValues.push(co);
                   }
                }
                this.generateIndices(sides[1], sides[0], this.orthoIndices);
                isolines.computeIsolines(1, 0, 2, this.plane, this.orthoVertices);
                break;
        }

		this.isolinesVertices = isolines.getIsolinesVertices();
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			showOrthoslice: this.showOrthoslice,
			dataset: this.dataset,
			axis: this.axis,
			plane: this.plane,
			colormapName: this.colormapName,
            valueMin: this.valueRange[0],
            valueMax: this.valueRange[1],
			colorClasses: this.colorClasses,
			useColorClasses: this.useColorClasses,
			showIsolines: this.showIsolines,
			isoValue: this.isoValue,
			colorIsolines: this.colorIsolines,
		};
	}

	/**
	 * Channel handler for parameters change
     *
     * @param params - All parameters
	 */
	private channelChange(params: CtrlParams): void {

        this.dataset = params.dataset as number ?? 0;
        this.axis = params.axis as number ?? 0;
        this.plane = params.plane as number ?? 0;
        this.useColorClasses = params.useColorClasses as boolean ?? false;
        this.colorClasses = params.colorClasses as number ?? 5;
        this.isoValue = params.isoValue as number ?? 0;
		this.showOrthoslice = params.showOrthoslice as boolean ?? false;
        this.showIsolines = params.showIsolines as boolean ?? false;
        this.limitLow = params.limitLow as number ?? -10;
        this.limitHigh = params.limitHigh as number ?? 10;

        this.orthoVertices.length = 0;
        this.orthoIndices.length = 0;
        this.orthoValues.length = 0;
        this.isolinesVertices.length = 0;
        this.isolineValues.length = 0;

        // Check if the plane should be created
        if(this.structure &&
           this.structure.volume.length > 0 &&
           this.structure.volume[this.dataset].values.length > 0) {

            // The number of planes is one more the sides. The last plane is equal to the first one
            this.maxPlane = this.structure.volume[this.dataset].sides[this.axis];

            // Check if the plane should be created
            if(this.showOrthoslice || this.showIsolines) this.computeOrthoslice();
        }

        sendIsoOrthoToClient(this.id, "computed",
                            {
                                vertices: this.orthoVertices,
                                indices: this.orthoIndices,
                                values: this.orthoValues,
                                isolineVertices: this.isolinesVertices,
                                isolineValues: this.isolineValues,
                                params: {
                                    countDatasets: this.countDatasets,
                                    maxPlane: this.maxPlane,
                                    valueMin: this.valueRange[0],
                                    valueMax: this.valueRange[1],
                                }
                            });
    }

	/**
	 * Channel handler for parameters change
     *
     * @param params - All parameters that do not need recomputation
	 */
	private channelShow(params: CtrlParams): void {
        this.colormapName = params.colormapName as string ?? "rainbow";
        this.colorIsolines = params.colorIsolines as boolean ?? false;
    }
}
