/**
 * Extract the enclosing polyhedra
 *
 * @packageDocumentation
 */

import * as THREE from "three";
import {ConvexGeometry} from "three/addons/geometries/ConvexGeometry.js";
import {sb, type UiParams} from "@/services/Switchboard";
import type {Structure} from "@/types";
import {sm} from "@/services/SceneManager";

type SelectorType = "symbol" | "label" | "index";

export class DrawPolyhedra {

	private color = "#FFFFFF80";
	private labelKind = "symbol";
	private atomsSelector = "";
	private structure: Structure | undefined;
	private visible = false;

	private readonly material = new THREE.MeshLambertMaterial({
										color: "#FFFFFF",
										opacity: 0.5,
										side: THREE.FrontSide,
										transparent: true
									});

	private readonly group = new THREE.Group();

	/**
	 * Create the node
	 *
	 * @param id - ID of the Draw Polyhedra node
	 */
	constructor(private readonly id: string) {

		this.group.clear();
		sm.add(this.group);

		sb.getUiParams(this.id, (params: UiParams) => {

			this.visible = params.showPolyhedra as boolean ?? false;
			this.color = params.surfaceColor as string ?? "#FFFFFF80";
    		this.labelKind = params.labelKind as SelectorType ?? "symbol";
    		this.atomsSelector = params.atomsSelector as string ?? "";

			this.group.visible = this.visible;
			this.material.opacity = this.extractOpacity(this.color);
			this.material.color = this.extractColor(this.color);

			this.createPolyhedra();
		});

		sb.getData(this.id, (data: unknown) => {

			this.structure = data as Structure;
			this.createPolyhedra();
		});
	}

	/**
	 * Create the polyhedrons if visible
	 */
	private createPolyhedra(): void {

		// Empty the group
		this.group.clear();

		// Don't compute if it is invisible or there are no atoms
		if(!this.visible || !this.structure) return;

		// Extract the polyhedrons vertices
		const islands = this.createVerticeLists();
		if(islands.length === 0) return;

		for(const island of islands) {
			const mesh = new THREE.Mesh();
			mesh.geometry = new ConvexGeometry(island);
			mesh.material = this.material;
			this.group.add(mesh);
		}
	}

	/**
	 * Compute vertices
	 *
	 * @returns List of lists of polyhedrons vertices
	 */
	private createVerticeLists(): THREE.Vector3[][] {

		// Prepare selectors
		this.atomsSelector = this.atomsSelector.trim();
		if(this.atomsSelector === "") return [];
		const selectors = this.atomsSelector.toLowerCase().split(/ +/);

		// Extract structure parts
		const {atoms, bonds, look} = this.structure!;

		// Sanity checks
		const natoms = atoms.length;
		if(natoms < 4) return [];

		if(bonds.length === 0) return [];

		// Select the polyhedra center atoms
		const centerIdx = [];

		if(this.labelKind === "symbol") {
			const numericSelectors = [];
			for(const selector of selectors) {
				for(const atomZ in look) {
					if(look[atomZ].symbol.toLowerCase() === selector) {
						numericSelectors.push(Number(atomZ));
						break;
					}
				}
			}
			for(let idx=0; idx < natoms; ++idx) {
				for(const selector of numericSelectors) {
					if(selector === atoms[idx].atomZ) {
						centerIdx.push(idx);
						break;
					}
				}
			}
		}
		else if(this.labelKind === "index") {
			for(const selector of selectors) {
				const index = Number.parseInt(selector, 10);
				if(Number.isNaN(index)) return [];
				centerIdx.push(index);
			}
		}
		else { // Select by "label"
			for(let idx=0; idx < natoms; ++idx) {
				const label = atoms[idx].label.toLowerCase();
				for(const selector of selectors) {
					if(label === selector) {
						centerIdx.push(idx);
						break;
					}
				}
			}
		}

		// Create lists of connected atoms (island)
		const islands: number[][] = [];

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
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
