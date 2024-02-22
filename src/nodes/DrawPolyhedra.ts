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

export class DrawPolyhedra {

	private readonly mesh = new THREE.Mesh();
	private readonly material = new THREE.MeshLambertMaterial({
										color: "#FFFFFF",
										opacity: 0.5,
										side: THREE.FrontSide,
										transparent: true
									});
	private color = "#FFFFFF80";

	private readonly adjListArray: number[][] = [];

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

			this.group.visible = params.showPolyhedra as boolean ?? false;
			this.color = params.surfaceColor as string ?? "#FFFFFF80";

			this.material.opacity = this.extractOpacity(this.color);
			this.material.color = this.extractColor(this.color);
		});

		sb.getData(this.id, (data: unknown) => {

			// Empty the group
			this.group.clear();

			// Extract the polyhedrons vertices
			const islands = this.createVerticeLists(data as Structure);
			if(islands.length === 0) return;

			for(const island of islands) {
				const mesh = new THREE.Mesh();
				mesh.geometry = new ConvexGeometry(island);
				mesh.material = this.material;
				this.group.add(mesh);
			}
		});
	}

	private createVerticeLists(structure: Structure): THREE.Vector3[][] {

		// Sanity checks
		if(!structure?.atoms) return [];

		const natoms = structure.atoms.length;
		if(natoms < 4) return [];

		const {bonds} = structure;
		if(bonds.length === 0) return [];

		// Javascript program to print connected components in
		// an undirected graph
		// This code is contributed by rag2127
		// on https://www.geeksforgeeks.org/connected-components-in-an-undirected-graph/


		// A graph is an array of adjacency lists.
		// Size of array will be natoms (number of vertices in graph)

		// Create a new list for each vertex
		// such that adjacent nodes can be stored
		this.adjListArray.length = 0;
		for(let i = 0; i < natoms; ++i)  this.adjListArray.push([]);

		// Adds edges to the undirected graph
		for(const bond of bonds) {

			// Add an edge from src to dest
			this.adjListArray[bond.from].push(bond.to);

			// Since graph is undirected, add an edge from dest to src also
			this.adjListArray[bond.to].push(bond.from);
		}

		// Mark all the vertices as not visited
		const visited = Array(natoms).fill(false) as boolean[];

		const islands: number[][] = [];

		for(let vertex = 0; vertex < natoms; ++vertex) {

			if(!visited[vertex]) {

				// Extract all reachable vertices from vertex
				const component = this.DFSUtil(vertex, visited);
				if(component.length > 3) islands.push(component);
			}
		}

		// Convert atom indexes to list of coordinates
		const out: THREE.Vector3[][] = [];
		for(const island of islands) {

			const oneIsland: THREE.Vector3[] = [];
			for(const atomIdx of island) {
				// eslint-disable-next-line unicorn/consistent-destructuring
				const {position} = structure.atoms[atomIdx];
				oneIsland.push(new THREE.Vector3(position[0], position[1], position[2]));
			}
			out.push(oneIsland);
		}
		return out;
	}

	private DFSUtil(vertex: number, visited: boolean[]): number[] {

		// Mark the current node as visited and save it
		visited[vertex] = true;
		let component = [vertex];

		// Recur for all the vertices adjacent to this vertex
		// eslint-disable-next-line @typescript-eslint/prefer-for-of
		for(let x = 0; x < this.adjListArray[vertex].length; ++x) {

			if(!visited[this.adjListArray[vertex][x]]) {
				const toAdd = this.DFSUtil(this.adjListArray[vertex][x], visited);
				component = [...component, ...toAdd];
			}
		}

		return component;
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

			showPolyhedra: this.mesh.visible,
			color: this.color,
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
