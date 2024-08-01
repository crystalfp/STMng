/**
 * Compute one or more isosurfaces of the volumetric data.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import * as THREE from "three";
import {Lut} from "three/addons/math/Lut.js";
import {sb, type UiParams} from "@/services/Switchboard";
import {sm} from "../../new/services/SceneManager";
import type {Structure, PositionType, BasisType} from "@/types";
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

    private datasetPrevious = -1;
    private isovaluePrevious = Number.NEGATIVE_INFINITY;
    private countIsosurfacesPrevious = 0;
    private limitLowPrevious = Number.NEGATIVE_INFINITY;
    private limitHighPrevious = Number.POSITIVE_INFINITY;
    private rangePrevious = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];

    private nestedIsosurfaces = false;
    private countIsosurfaces = 2;
    private limitLow = -10;
    private limitHigh = 10;
    private limitColormap = false;

    private readonly group = new THREE.Group();

    /**
    * Create the node
    *
    * @param id - ID of the Isosurface node
    */
    constructor(private readonly id: string) {

        // Create the group that will contains one or more isosurfaces
        this.group.name = `Isosurfaces-${this.id}`;
        sm.clearGroup(this.group.name, true);
        sm.add(this.group);

        sb.getUiParams(this.id, (params: UiParams) => {

            this.showIsosurface = params.showIsosurface as boolean ?? false;
            this.dataset = params.dataset as number ?? 0;
            this.isoValue = params.isoValue as number ?? 0;
            this.colormapName = params.colormapName as string ?? "rainbow";
            this.lut = new Lut(this.colormapName, 512);
            this.opacity = params.opacity as number ?? 1;

            this.nestedIsosurfaces = params.nestedIsosurfaces as boolean ?? false;
            this.countIsosurfaces = params.countIsosurfaces as number ?? 2;
            this.limitLow = params.limitLow as number ?? -10;
            this.limitHigh = params.limitHigh as number ?? 10;
            this.limitColormap = params.limitColormap as boolean ?? false;

            // Check if it is need to change only material and visibility of the surfaces
            if(this.isSurfaceChanged()) {

                this.createIsosurface();
            }
            else {

                this.lut.setColorMap(this.colormapName, 512);
                if(this.limitColormap) {
                    this.lut.setMin(this.limitLow);
                    this.lut.setMax(this.limitHigh);
                }
                else {
                    this.lut.setMin(this.range[0]);
                    this.lut.setMax(this.range[1]);
                }

                this.group.visible = this.showIsosurface;

                this.group.traverse((mesh) => {
                    if(mesh.type !== "Mesh") return;
                    const {isoValue} = mesh.userData;
                    const material = (mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
                    material.opacity = this.opacity;
                    material.transparent = this.opacity < 0.99;
                    material.color = this.lut.getColor(isoValue as number);
                });
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
                if(this.dataset >= countDatasets) this.dataset = 0;
                this.maxDataset = countDatasets - 1;
                this.range = this.getValueLimits();
                this.isoValue = (this.range[0]+this.range[1])/2;
            }
            this.limitLow = this.range[0];
            this.limitHigh = this.range[1];

            sb.setUiParams(this.id, {
                showIsosurface: this.showIsosurface,
                dataset: this.dataset,
                maxDataset: this.maxDataset,
                valueMin: this.range[0],
                valueMax: this.range[1],
                isoValue: this.isoValue,
                limitLow: this.limitLow,
                limitHigh: this.limitHigh
            });

            this.createIsosurface();
        });
    }

    /**
     * Check if the surface has changed
     *
     * @returns True if the surface has changed
     */
    private isSurfaceChanged(): boolean {

        let changed;
        if(this.nestedIsosurfaces) {

            changed = this.dataset !== this.datasetPrevious ||
                      this.countIsosurfaces !== this.countIsosurfacesPrevious ||
                      this.limitHigh !== this.limitHighPrevious ||
                      this.limitLow !== this.limitLowPrevious ||
                      this.rangePrevious[0] !== this.range[0] ||
                      this.rangePrevious[1] !== this.range[1];

            if(changed) {
                this.datasetPrevious = this.dataset;
                this.countIsosurfacesPrevious = this.countIsosurfaces;
                this.limitHighPrevious = this.limitHigh;
                this.limitLowPrevious = this.limitLow;
                this.rangePrevious[0] = this.range[0];
                this.rangePrevious[1] = this.range[1];
            }
        }
        else {
            changed = this.dataset !== this.datasetPrevious ||
                      this.isoValue !== this.isovaluePrevious;
            if(changed) {
                this.datasetPrevious = this.dataset;
                this.isovaluePrevious = this.isoValue;
            }
        }
        return changed;
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
     * Create a new isosurface or multiple isosurfaces
     */
    createIsosurface(): void {

        // Remove existing surfaces
        sm.clearGroup(this.group.name);

        // Check if the isosurface could be created
        if(!this.structure?.volume ||
            this.structure.volume.length === 0 ||
            this.structure.volume[this.dataset]?.values.length === 0) return;

        // Access the needed values
        const {basis, origin} = this.structure.crystal;
        const {sides, values} = this.structure.volume[this.dataset];

        // A unit cell is needed to create the isosurface
        if(basis.every((value) => value === 0)) return;

        // Create one or more isosurfaces
        if(this.nestedIsosurfaces) {

            const delta = (this.limitHigh - this.limitLow) / (this.countIsosurfaces-1);
            let isoValue = this.limitLow;
            for(let i=0; i < this.countIsosurfaces; ++i) {
                this.createIsosurfaceMesh(sides, basis, origin, values, isoValue);
                isoValue += delta;
            }
        }
        else {
            this.createIsosurfaceMesh(sides, basis, origin, values, this.isoValue);
        }

        // Make them visible if needed
        this.group.visible = this.showIsosurface;
    }

    /**
     * Create a single isosurface mesh
     *
     * @param sides - Sides of the volumetric data
     * @param basis - Basis vectors
     * @param origin - Unit cell origin
     * @param values - Volumetric values to be used
     * @param isoValue - Isosurface value at which the surface should be created
     */
    private createIsosurfaceMesh(sides: PositionType, basis: BasisType, origin: PositionType,
                                 values: number[], isoValue: number): void {

        // Compute the triangulated surface
        const iso = new IsosurfaceCore(sides, basis, origin, values);
        iso.computeIsosurface(isoValue);

        // Create and add the surface to the scene
        const geometry = new THREE.BufferGeometry();
        geometry.setIndex(iso.indices);
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(iso.vertices, 3));
        geometry.setAttribute("normal",   new THREE.Float32BufferAttribute(iso.normals, 3));

        if(this.limitColormap) {
            this.lut.setMin(this.limitLow);
            this.lut.setMax(this.limitHigh);
        }
        else {
            this.lut.setMin(this.range[0]);
            this.lut.setMax(this.range[1]);
        }

        const material = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            color: this.lut.getColor(isoValue).getHex(),
            opacity: this.opacity,
            roughness: 0.5,
            metalness: 0.6,
            transparent: this.opacity < 0.99,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = {isoValue};
        this.group.add(mesh);
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
            nestedIsosurfaces: this.nestedIsosurfaces,
            countIsosurfaces: this.countIsosurfaces,
            limitLow: this.limitLow,
            limitHigh: this.limitHigh,
            limitColormap: this.limitColormap,
        };
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
    }
}
