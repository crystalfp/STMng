/**
 * Render graphical output for Draw Orthoslice.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-01
 */
import * as THREE from "three";
import {Lut} from "three/addons/math/Lut.js";
import {sm} from "@/services/SceneManager";

export class DrawOrthosliceRenderer {

	private readonly lut = new Lut("rainbow", 512);

	private orthosliceMesh: THREE.Mesh | undefined;
	private readonly meshName;

	private isolinesGroup: THREE.Group | undefined;
	private readonly isolinesName;

	constructor(private readonly id: string) {

		// Prepare the names of the various graphical objects
		this.meshName = "Orthoslice-" + this.id;
		this.isolinesName = "Isolines-" + this.id;

		// Initialize the colormap
		this.lut.setMax(10);
		this.lut.setMin(-10);
	}

	/**
	 * Draw orthoslice and isolines
	 *
	 * @param vertices - Coordinates of the vertices of the orthoslice
	 * @param indices - List of indices of the triangles composing the orthoslice
	 * @param values - Values of each point on the orthoslice
	 * @param isolineVertices - Coordinates of the various isolines
	 * @param isolineValues - Values for each isoline
	 * @param showOrthoslice - Orthoslice visibility
	 * @param showIsolines - Isolines visibility
	 * @param colorIsolines - Color isolines, otherwise they are black
	 */
	// eslint-disable-next-line max-params
	drawOrthoIso(vertices: number[],
				 indices: number[],
				 values: number[],
				 isolineVertices: number[][],
				 isolineValues: number[],
				 showOrthoslice: boolean,
				 showIsolines: boolean,
				 colorIsolines: boolean): void {

		// Remove the existing plane
		sm.deleteMesh(this.meshName);

		// Remove existing isolines
		sm.clearGroup(this.isolinesName, true);
		this.isolinesGroup = new THREE.Group();
		this.isolinesGroup.name = this.isolinesName;
		sm.add(this.isolinesGroup);

		// Sanity check
		if(!vertices || !indices || !values || !isolineVertices || !isolineValues) return;
		if(vertices.length === 0 || indices.length === 0 || values.length === 0 ||
		isolineVertices.length === 0 || isolineValues.length === 0) return;

		// Create the isoline colors
		const isolineColors = isolineValues.map((value) => this.lut.getColor(value).getHex());

		// Create the orthoslice colors
		const colors: number[] = [];
		for(const oneValue of values) {
			const color = this.lut.getColor(oneValue);
			colors.push(color.r, color.g, color.b);
		}

		// Create and add the plane to the scene with no lighting effects
		const geometry = new THREE.BufferGeometry();
		geometry.setIndex(indices);
		geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
		geometry.setAttribute("color",    new THREE.Float32BufferAttribute(colors, 3));

		const material = new THREE.MeshBasicMaterial({
			side: THREE.DoubleSide,
			vertexColors: true,
			polygonOffset: true,
			polygonOffsetFactor: 1
		});

		this.orthosliceMesh = new THREE.Mesh(geometry, material);
		this.orthosliceMesh.name = this.meshName;
		this.orthosliceMesh.visible = showOrthoslice;
		sm.add(this.orthosliceMesh);

		// Add the isolines
		const countIsolines = isolineVertices.length;
		for(let idx=0; idx < countIsolines; ++idx) {

			const orthoGeometry = new THREE.BufferGeometry();
			orthoGeometry.setAttribute("position", new THREE.Float32BufferAttribute(isolineVertices[idx], 3));

			const color = colorIsolines ? isolineColors[idx] : 0x000000;
			const line = new THREE.LineSegments(orthoGeometry, new THREE.LineBasicMaterial({color}));
			this.isolinesGroup.add(line);
		}

		this.isolinesGroup.visible = showIsolines;
	}

	/**
	 * Set visibility
	 *
	 * @param showIsolines - Show isolines
	 * @param showOrthoslice - Show orthoslice
	 */
	setVisibility(showIsolines: boolean, showOrthoslice: boolean): void {

	    if(this.isolinesGroup) this.isolinesGroup.visible = showIsolines;
    	if(this.orthosliceMesh) this.orthosliceMesh.visible = showOrthoslice;
    	sm.modified();
	}

	/**
	 * Set the colormap to use
	 *
	 * @param colormapName - Name of the colormap to use
	 * @param valueMin - Minimum value for the colormap start
	 * @param valueMax - Maximum value for the colormap end
	 * @param useColorClasses - Display colormap split in classes
	 * @param colorClasses - Number of color classes
	 */
	setLut(colormapName: string, valueMin: number, valueMax: number,
		   useColorClasses: boolean, colorClasses: number): void {

		this.lut.setColorMap(colormapName, useColorClasses ? colorClasses : 512);
		this.lut.setMax(valueMax);
		this.lut.setMin(valueMin);
	}
}
