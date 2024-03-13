/**
 * Compute an orthoslice of the volumetric data. If requested show also the isolines
 *
 * @packageDocumentation
 */
import * as THREE from "three";
import {Lut} from "three/addons/math/Lut.js";
import {sb, type UiParams} from "@/services/Switchboard";
import {sm} from "@/services/SceneManager";
import type {Structure} from "@/types";
import {IsosurfaceCore} from "@/services/Isosurface";

export class Isosurface {

	private showIsosurface = false;
	private structure: Structure | undefined;
	private dataset = 0;
	private maxDataset = 0;
	private isoValue = 0;
    private range: [number, number] = [-10, 10];
    private colormapName = "rainbow";
    private lut = new Lut(this.colormapName, 512);
	private opacity = 1;

	private datasetPrevious = 0;
	private isovaluePrevious = 0;

	private mesh: THREE.Mesh | undefined;

	/**
	 * Create the node
	 *
	 * @param id - ID of the Isosurface node
	 */
	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {
    		this.showIsosurface = params.showIsosurface as boolean ?? false;
			this.dataset = params.dataset as number ?? 0;
    		this.isoValue = params.isoValue as number ?? 0;
            this.colormapName = params.colormapName as string ?? "rainbow";
            this.lut = new Lut(this.colormapName, 512);
			this.opacity = params.opacity as number ?? 1;

			// Check if needs to change only material and visibility of the surface
			if(this.mesh &&
			   this.dataset === this.datasetPrevious &&
			   this.isoValue === this.isovaluePrevious) {

				this.mesh.visible = this.showIsosurface;
				const material = this.mesh.material as THREE.MeshStandardMaterial;
				material.opacity = this.opacity;
				material.transparent = this.opacity < 0.99;
				this.lut.setColorMap(this.colormapName, 512);
				this.lut.setMin(this.range[0]);
				this.lut.setMax(this.range[1]);

				material.color = this.lut.getColor(this.isoValue);
			}
			else {
				this.datasetPrevious = this.dataset;
				this.isovaluePrevious = this.isoValue;
				this.createIsosurface();
			}
		});

		sb.getData(this.id, (data: unknown) => {

			this.structure = data as Structure;
			if(!this.structure?.volume) return;

			const countDatasets = this.structure.volume.length;
			if(countDatasets === 0) {
				this.showIsosurface = false;
				this.dataset = 0;
				this.maxDataset = 0;
                this.range = [-10, 10];
				this.isoValue = 0;
			}
			else {
				this.dataset = 0;
				this.maxDataset = countDatasets - 1;
				this.range = this.getValueLimits();
				this.isoValue = (this.range[0]+this.range[1])/2;
				this.datasetPrevious = this.dataset;
				this.isovaluePrevious = this.isoValue;
			}

			sb.setUiParams(this.id, {
				showIsosurface: this.showIsosurface,
				dataset: 0,
				maxDataset: this.maxDataset,
                valueMin: this.range[0],
                valueMax: this.range[1],
				isoValue: this.isoValue
			});

			this.createIsosurface();
		});
	}

    /**
     * Get the volume value range for the colormap
     *
     * @returns [min volume value, max volume value]
     */
    private getValueLimits(): [number, number] {

        // Check if the plane should be created
        if(!this.structure?.volume) return [-10, 10];
        const {values} = this.structure.volume[this.dataset];
        if(values.length === 0) return [-10, 10];

        // Set the value range for the color map
        let minValue = Number.POSITIVE_INFINITY;
        let maxValue = Number.NEGATIVE_INFINITY;
        for(const value of values) {
            if(value < minValue) minValue = value;
            if(value > maxValue) maxValue = value;
        }

        return [minValue, maxValue];
    }

	/**
	 * Create a new isosurface
	 */
	createIsosurface(): void {

        // Remove the existing surface
        const meshName = `Isosurface-${this.id}`;
        sm.deleteMesh(meshName);

        // Check if the isosurface should be created
        if(!this.showIsosurface ||
           !this.structure?.volume ||
            this.structure.volume[this.dataset].values.length === 0) return;

        // Access the needed values
        const {basis, origin} = this.structure.crystal;
        const {sides, values} = this.structure.volume[this.dataset];

		// If no unit cell return
		if(basis.every((value) => value === 0)) return;

		// Compute the triangulated surface
		const iso = new IsosurfaceCore(sides, basis, origin, values);
		iso.computeIsosurface(this.isoValue);

		// Create and add the surface to the scene
        const geometry = new THREE.BufferGeometry();
		geometry.setIndex(iso.indices);
		geometry.setAttribute("position", new THREE.Float32BufferAttribute(iso.vertices, 3));
		geometry.setAttribute("normal",   new THREE.Float32BufferAttribute(iso.normals, 3));

		this.lut.setMin(this.range[0]);
		this.lut.setMax(this.range[1]);

        const material = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
			color: this.lut.getColor(this.isoValue).getHex(),
			opacity: this.opacity,
			roughness: 0.5,
			metalness: 0.6,
			transparent: this.opacity < 0.99,
			// depthWrite: false,
        });

		this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.name = meshName;
        this.mesh.visible = this.showIsosurface;
        sm.add(this.mesh);
	}

	/**
	 * Save the node status
	 *
	 * @returns The JSON formatted status to be saved
	 */
	saveStatus(): string {

        const statusToSave = {
			showIsosurface: this.showIsosurface,
			dataset: this.dataset,
    		isoValue: this.isoValue,
            colormapName: this.colormapName,
			opacity: this.opacity,
        };
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
