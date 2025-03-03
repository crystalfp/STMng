/**
 * Render graphical output for Draw Polyhedra.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-11-29
 */
import {MeshLambertMaterial, FrontSide, Group, Vector3,
		Color, Mesh, EdgesGeometry, LineSegments, LineBasicMaterial} from "three";
import {sm} from "@/services/SceneManager";
import {ConvexGeometry} from "three/addons/geometries/ConvexGeometry.js";

export class DrawPolyhedraRenderer {

	private readonly group = new Group();
	private readonly name;
	private readonly polyhedraVertices: Vector3[][] = [];
	private readonly centerAtomColorList: string[] = [];
	private countPolyhedra = 0;
	private readonly material = new MeshLambertMaterial({
		color: "#FFFFFF",
		opacity: 0.5,
		side: FrontSide,
		transparent: true,
		polygonOffset: true,
		polygonOffsetFactor: 1
	});

	constructor(id: string) {

		// Prepare the names of the various graphical objects
		this.name = "DrawPolyhedra-" + id;

		// Prepare the group for the polyhedra and add it to the scene
		this.group.name = this.name;
		sm.clearAndAddGroup(this.group);
	}

	/**
	 * Find a contrasting color
	 *
	 * @param materialColor - Polyhedra color
	 * @param bw - True (default) to create contrasting black and white color
	 * @returns Color for the polyhedra edges
	 */
	private createContrastingColor(materialColor: Color, bw=true): number {

		const {r, g, b} = materialColor;

		// B&W output (https://stackoverflow.com/a/3943023/112731)
		if(bw) return (r * 76.245 + g * 149.685 + b * 29.07) > 186 ? 0x000000 : 0xFFFFFF;

		// Invert color components
		return (((1-r)*255 + (1-g))*255 + (1-b))*255;
	}

	/**
	 * Prepare the data received from the main process
	 *
	 * @param vertices - Polyhedra vertices received from the main process
	 * @param centerAtomsColor - Color of the polyhedra center atoms
	 */
	formatPolyhedraData(vertices: number[][], centerAtomsColor: string[]): void {

		// Format the received data
		this.polyhedraVertices.length = 0;
		this.centerAtomColorList.length = 0;
		this.countPolyhedra = vertices.length;
		for(let i=0; i < this.countPolyhedra; ++i) {

			// Convert the list of coordinates into a THREE.Vector3 list
			const points: Vector3[] = [];
			const len = vertices[i].length;
			for(let j=0; j < len; j += 3) {
				const point = new Vector3(vertices[i][j], vertices[i][j+1], vertices[i][j+2]);
				points.push(point);
			}
			this.polyhedraVertices.push(points);

			// Save the list of center atoms colors
			this.centerAtomColorList.push(centerAtomsColor[i]);
		}
	}

	/**
	 * Create the graphical objects
	 *
	 * @param colorByCenterAtom - If the polyhedra should be colored by the center atom
	 * @param showPolyhedra - If the polyhedra are visible
	 */
	drawPolyhedra(colorByCenterAtom: boolean, showPolyhedra: boolean): void {

		// Empty the group
		this.group.clear();

		for(let i=0; i < this.countPolyhedra; ++i) {

			// The polyhedron
			const mesh = new Mesh();
			mesh.geometry = new ConvexGeometry(this.polyhedraVertices[i]);
			mesh.name = "Polyhedron";
			let color;
			if(colorByCenterAtom) {
				const polyhedraMaterial = this.material.clone();
				color = new Color(this.centerAtomColorList[i]);
				polyhedraMaterial.color = color;
				mesh.material = polyhedraMaterial;
			}
			else {
				mesh.material = this.material.clone();
				color = this.material.color;
			}
			this.group.add(mesh);

			// Identify the polyhedron
			mesh.userData = {idx: i};

			// The polyhedron edges
			const edgeColor = this.createContrastingColor(color);
			const edges = new EdgesGeometry(mesh.geometry);
			const line = new LineSegments(edges, new LineBasicMaterial({color: edgeColor}));
			this.group.add(line);
		}

		this.group.visible = showPolyhedra;
		sm.modified();
	}

	/**
	 * Change polyhedra visibility
	 *
	 * @param visible - If the polyhedra should be visible
	 * @returns True if only the visibility changes
	 */
	changeVisibility(visible: boolean): boolean {

		if(this.group.visible !== visible) {
			this.group.visible = visible;
			sm.modified();
			return true;
		}
		return false;
	}

	/**
	 * Change polyhedra opacity
	 *
	 * @param opacity - Opacity of the polyhedra
	 */
	changeOpacity(opacity: number): void {
		this.material.opacity = opacity;
	}

	/**
	 * Extract the color from a string containing alpha
	 *
	 * @param color - Color in #RRGGBBAA format
	 * @returns The color part
	 */
	private extractColor(color: string): Color {

		const colorString = color.slice(0, 7);
		return new Color(colorString);
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
	 * Change polyhedra surface color
	 *
	 * @param surfaceColor - Color to be set in #RRGGBBAA format
	 */
	changeColor(surfaceColor: string): void {
		this.material.color = this.extractColor(surfaceColor);
		this.material.opacity = this.extractOpacity(surfaceColor);
	}
}
