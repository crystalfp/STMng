/**
 * Extract the enclosing polyhedra
 *
 * @packageDocumentation
 */

import * as THREE from "three";
import {ConvexGeometry} from "three/addons/geometries/ConvexGeometry.js";
import {sb, type UiParams} from "@/services/Switchboard";
import {sm} from "../../new/services/SceneManager";
import type {Structure} from "../../new/types";
import {selectAtomsByKind, type SelectorType} from "@/services/SelectAtoms";
import {atomColor} from "@/services/AtomInfo";

export class DrawPolyhedra {

	private color = "#FFFFFF80";
	private labelKind: SelectorType = "symbol";
	private atomsSelector = "";
	private structure: Structure | undefined;
	private visible = false;
	private colorByCenterAtom = true;
	private readonly centerAtomsColor: string[] = [];
	private opacityByCenterAtom = 0.5;

	private readonly material = new THREE.MeshLambertMaterial({
										color: "#FFFFFF",
										opacity: 0.5,
										side: THREE.FrontSide,
										transparent: true,
										polygonOffset: true,
										polygonOffsetFactor: 1
									});

	private group: THREE.Group | undefined;

	/**
	 * Create the node
	 *
	 * @param id - ID of the Draw Polyhedra node
	 */
	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {

			this.visible = params.showPolyhedra as boolean ?? false;
			this.color = params.surfaceColor as string ?? "#FFFFFF80";
    		this.labelKind = params.labelKind as SelectorType ?? "symbol";
    		this.atomsSelector = params.atomsSelector as string ?? "";
			this.colorByCenterAtom = params.colorByCenterAtom as boolean ?? false;
			this.opacityByCenterAtom = params.opacityByCenterAtom as number ?? 0.5;

			if(this.visible) {
				if(!this.group) {
					this.group = new THREE.Group();
					this.group.name = `DrawPolyhedra-${this.id}`;
					sm.add(this.group);
				}
				this.material.color = this.extractColor(this.color);
				this.material.opacity = this.colorByCenterAtom ?
												this.opacityByCenterAtom :
												this.extractOpacity(this.color);

				this.createPolyhedra();
				this.group.visible = true;
			}
			else if(this.group) this.group.visible = false;
		});

		sb.getData(this.id, (data: unknown) => {

			this.structure = data as Structure;
			if(this.group) this.createPolyhedra();
		});
	}

	/**
	 * Find a contrasting color
	 *
	 * @param materialColor - Polyhedra color
	 * @param bw - True (default) to create contrasting black and white color
	 * @returns Color for the polyhedra edges
	 */
	private createContrastingColor(materialColor: THREE.Color, bw=true): number {

    	const {r, g, b} = materialColor;

		// B&W output (https://stackoverflow.com/a/3943023/112731)
		if(bw) return (r * 76.245 + g * 149.685 + b * 29.07) > 186 ? 0x000000 : 0xFFFFFF;

		// Invert color components
		return (((1-r)*255 + (1-g))*255 + (1-b))*255;
	}

	/**
	 * Create the polyhedrons if visible
	 */
	private createPolyhedra(): void {

		// Empty the group
		this.group!.clear();

		// Don't compute if it is invisible or there are no atoms
		if(!this.visible || !this.structure) return;

		// Extract the polyhedrons vertices
		const islands = this.createVerticeLists();
		if(islands.length === 0) return;

		let polyhedronIdx = 0;
		let idx = 0;
		for(const island of islands) {

			// The polyhedron
			const mesh = new THREE.Mesh();
			mesh.geometry = new ConvexGeometry(island);
			mesh.name = "Polyhedron";
			if(this.colorByCenterAtom) {
				const material = this.material.clone();
				material.color = new THREE.Color(this.centerAtomsColor[idx]);
				mesh.material = material;

				++idx;
			}
			else {
				mesh.material = this.material.clone();
			}
			this.group!.add(mesh);

			// Identify the polyhedron
			mesh.userData = {idx: polyhedronIdx};
			++polyhedronIdx;

			// The polyhedron edges
			const edgeColor = this.createContrastingColor(this.material.color);
			const edges = new THREE.EdgesGeometry(mesh.geometry);
			const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({color: edgeColor}));
			this.group!.add(line);
		}
	}

	/**
	 * Compute vertices
	 *
	 * @returns List of lists of polyhedrons vertices
	 */
	private createVerticeLists(): THREE.Vector3[][] {

		// Extract structure parts
		const {atoms, bonds} = this.structure!;

		// Sanity checks
		const natoms = atoms.length;
		if(natoms < 4) return [];
		if(bonds.length === 0) return [];

		// Select the polyhedra center atoms
		const centerIdx = selectAtomsByKind(this.structure!, this.labelKind, this.atomsSelector);

		// Create lists of connected atoms (island)
		const islands: number[][] = [];
		this.centerAtomsColor.length = 0;

		for(const idx of centerIdx) {
			const connected = [];
			for(const bond of bonds) {
				if(bond.from === idx) {
					connected.push(bond.to);
				}
				else if(bond.to === idx) {
					connected.push(bond.from);
				}
			}

			if(connected.length > 3) {
				islands.push(connected);

				if(this.colorByCenterAtom) {
					const {atomZ} = this.structure!.atoms[idx];
					this.centerAtomsColor.push(atomColor(atomZ));
				}
			}
		}

		// Convert atom indexes to list of coordinates
		const out: THREE.Vector3[][] = [];
		for(const island of islands) {

			const oneIsland: THREE.Vector3[] = [];
			for(const atomIdx of island) {
				const {position} = atoms[atomIdx];
				oneIsland.push(new THREE.Vector3(position[0], position[1], position[2]));
			}
			out.push(oneIsland);
		}
		return out;
	}

	/**
	 * Extract the color from a string containing alpha
	 *
	 * @param color - Color in #RRGGBBAA format
	 * @returns The color part
	 */
	private extractColor(color: string): THREE.Color {

		const colorString = color.slice(0, 7);
		return new THREE.Color(colorString);
	}

	/**
	 * Extract the opacity from a string containing alpha
	 *
	 * @param color - Color in #RRGGBBAA format
	 * @returns The opacity value
	 */
	private extractOpacity(color: string): number {

		if(color.length < 9) return 1;
		return Number.parseInt(color.slice(7, 9), 16) / 255;
	}

	/**
	 * Save the node status
	 *
	 * @returns Node status as JSON formatted string
	 */
	saveStatus(): string {

		const statusToSave = {

			showPolyhedra: this.visible,
			color: this.color,
			labelKind: this.labelKind,
			atomsSelector: this.atomsSelector,
			colorByCenterAtom: this.colorByCenterAtom,
			opacityByCenterAtom: this.opacityByCenterAtom
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
