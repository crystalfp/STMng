/**
 * Compute an orthoslice of the volumetric data
 *
 * @packageDocumentation
 */
import * as THREE from "three";
import {Lut} from "three/addons/math/Lut.js";
import {sb, type UiParams} from "@/services/Switchboard";
import type {PositionType, Structure, BasisType} from "@/types";
import {sm} from "@/services/SceneManager";

export class Orthoslice {

	private dataset = 0;
	private axis = 0;
	private plane = 0;
	private showOrthoslice = false;
	private structure: Structure | undefined;
	private maxDataset = 0;
	private maxPlane = 0;
    private colormapName = "rainbow";
    private lut = new Lut("rainbow", 512);

	/**
	* Create the node
	*
	* @param id - ID of the Ortho Plane node
	*/
	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {
			this.showOrthoslice = params.showOrthoslice as boolean ?? false;
			this.dataset = params.dataset as number ?? 0;
			this.axis = params.axis as number ?? 0;
			this.plane = params.plane as number ?? 0;
            this.colormapName = params.colormapName as string ?? "rainbow";

            this.lut = new Lut( this.colormapName, 512);

			this.computeOrthoslice();
		});

		sb.getData(this.id, (data: unknown) => {

			this.structure = data as Structure;
			if(!this.structure?.volume) return;

			const countDatasets = this.structure.volume.length;
			if(countDatasets === 0) {

				this.showOrthoslice = false;
				this.dataset = 0;
				this.axis = 0;
				this.plane = 0;
				this.maxDataset = 0;
				this.maxPlane = 0;
			}
			else {
				this.dataset = 0;
				this.plane = 0;
				this.maxDataset = countDatasets - 1;

				// The number of planes is one more the sides. The last plane is equal to the first one
				this.maxPlane = this.structure.volume[0].sides[0];
			}
			sb.setUiParams(this.id, {
				showOrthoslice: this.showOrthoslice,
				dataset: this.dataset,
				axis: this.axis,
				plane: this.plane,
				maxDataset: this.maxDataset,
				maxPlane: this.maxPlane,
			});
			this.computeOrthoslice();
		});
	}

    /**
     * Compute the orthoslice for the given parameters
     */
	private computeOrthoslice(): void {

        // Remove the existing plane
        const {scene} = sm;
        const meshName = `Orthoslice-${this.id}`;
        const object = scene.getObjectByName(meshName) as THREE.Mesh;
        if(object) {
            scene.remove(object);
            if(object.geometry) object.geometry.dispose();
			(object.material as THREE.Material).dispose();
        }

        // Check if the plane should be created
        if(!this.showOrthoslice ||
           !this.structure?.volume ||
            this.structure.volume[this.dataset].values.length === 0) return;

        // Access the needed values
        const {basis, origin} = this.structure.crystal;
        const {sides, values} = this.structure.volume[this.dataset];

        // Prepare value mapping
        let minValue = Number.POSITIVE_INFINITY;
        let maxValue = Number.NEGATIVE_INFINITY;
        for(const value of values) {
            if(value < minValue) minValue = value;
            if(value > maxValue) maxValue = value;
        }
        this.lut.setMax(maxValue);
        this.lut.setMin(minValue);

        let fixed;
        const vertices: number[] = [];
        const indices: number[]  = [];
        const colors: number[]   = [];
        const normals: number[]  = [];

        switch(this.axis) {

            case 0: // X
                fixed = this.plane / sides[0];
                for(let ny=0; ny <= sides[1]; ++ny) {
                    for(let nz=0; nz <= sides[2]; ++nz) {
                        this.fractionToAbsolute(fixed, ny/sides[1], nz/sides[2],
                                                basis, origin, vertices);
                        colors.push(...this.colormap(this.plane, ny, nz, values, sides));
                    }
                }
                this.generateIndices(sides[2], sides[1], indices);
                this.generateNormals(sides[2], sides[1], 0, normals);
                break;

            case 1: // Y
                fixed = this.plane / sides[1];
                for(let nx=0; nx <= sides[0]; ++nx) {
                    for(let nz=0; nz <= sides[2]; ++nz) {
                        this.fractionToAbsolute(nx/sides[0], fixed, nz/sides[2],
                                                basis, origin, vertices);
                        colors.push(...this.colormap(nx, this.plane, nz, values, sides));
                    }
                }
                this.generateIndices(sides[2], sides[0], indices);
                this.generateNormals(sides[2], sides[0], 1, normals);
                break;

            case 2: // Z
                fixed = this.plane / sides[2];
                for(let nx=0; nx <= sides[0]; ++nx) {
                    for(let ny=0; ny <= sides[1]; ++ny) {
                        this.fractionToAbsolute(nx/sides[0], ny/sides[1], fixed,
                                                basis, origin, vertices);
                        colors.push(...this.colormap(nx, ny, this.plane, values, sides));
                    }
                }
                this.generateIndices(sides[1], sides[0], indices);
                this.generateNormals(sides[1], sides[0], 2, normals);
                break;
        }

        // Create and add the plane to the scene
        const geometry = new THREE.BufferGeometry();
		geometry.setIndex(indices);
		geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
		geometry.setAttribute("color",    new THREE.Float32BufferAttribute(colors, 3));
		geometry.setAttribute("normal",   new THREE.Float32BufferAttribute(normals, 3));

        const material = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            vertexColors: true
        });

		const mesh = new THREE.Mesh(geometry, material);
        mesh.name = meshName;
        scene.add(mesh);
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
                // indices.push(aa, bb, dd, aa, dd, cc);
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
     * @returns - The RGB color of the point
     */
    private colormap(nx: number, ny: number, nz: number,
                     values: number[], sides: PositionType): number[] {

        if(nx === sides[0]) nx = 0;
        if(ny === sides[1]) ny = 0;
        if(nz === sides[2]) nz = 0;

        const oneValue = values[nx + (ny + nz*sides[1])*sides[0]];
        const color = this.lut.getColor(oneValue);
        return [color.r, color.g, color.b];
    }

    /**
     * Compute the plane normals
     *
     * @param fastSide - The index that varies faster than the other
     * @param slowSide - The index that varies slower than the other
     * @param normalIdx - Index of the direction of the normal
     * @param normals - The computed normals
     */
    private generateNormals(fastSide: number, slowSide: number, normalIdx: number, normals: number[]): void {

        const {basis} = this.structure!.crystal;
        const idx = normalIdx*3;
        const normal = [basis[idx], basis[idx+1], basis[idx+2]];
        const len = -Math.hypot(...normal);

        for(let vv=0; vv <= slowSide; ++vv) {
            for(let uu=0; uu <= fastSide; ++uu) {
                normals.push(normal[0]/len, normal[1]/len, normal[2]/len);
            }
        }
    }

	/**
	* Save the node status
	*
	* @returns The JSON formatted status to be saved
	*/
	saveStatus(): string {

        const statusToSave = {
            dataset: this.dataset,
            axis: this.axis,
            plane: this.plane,
            showOrthoslice: this.showOrthoslice,
            colormapName: this.colormapName,
        };
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
