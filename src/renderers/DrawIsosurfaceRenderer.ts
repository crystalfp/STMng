/**
 * Render graphical output for Draw Isosurface.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-11-30
 */
import {Group, BufferGeometry, Float32BufferAttribute,
		MeshStandardMaterial, DoubleSide, Mesh} from "three";
import {Lut} from "three/addons/math/Lut.js";
import {sm} from "@/services/SceneManager";

/**
 * Renderer for isosurface graphical output
 */
export class DrawIsosurfaceRenderer {

	private readonly group = new Group();
	private readonly name;
	private readonly lut = new Lut("rainbow", 512);

	/**
	 * Build the renderer
	 *
	 * @param id - The corresponding node ID
	 */
	constructor(id: string) {

		// Prepare the names of the various graphical objects
		this.name = "Isosurface-" + id;

		// Prepare the group that will contains the isosurfaces and add it to the scene
		this.group.name = this.name;
		sm.clearAndAddGroup(this.group);

		// Initialize the colormap
		this.lut.setMax(10);
		this.lut.setMin(-10);
	}

	/**
	 * Create the isosurfaces
	 *
	 * @param indices - Indices of the triangulated surfaces
	 * @param vertices - Vertices of the surfaces
	 * @param normals - Surface triangles normals
	 * @param isoValues - Values associated to each surface
	 * @param opacity - Surface opacity
	 * @param showIsosurface - Surfaces visible
	 */
	drawIsosurfaces(indices: number[][],
					vertices: number[][],
					normals: number[][],
                    isoValues: number[],
					opacity: number,
					showIsosurface: boolean): void {

		// Remove existing surfaces
		sm.clearGroup(this.name);

		// Nothing to show
		const len = indices.length;
		if(len === 0) return;

		// Add single or nested isosurfaces
		for(let i=0; i < len; ++i) {

			// Create and add the surface to the scene
			const geometry = new BufferGeometry();
			geometry.setIndex(indices[i]);
			geometry.setAttribute("position", new Float32BufferAttribute(vertices[i], 3));
			geometry.setAttribute("normal",   new Float32BufferAttribute(normals[i], 3));

			const material = new MeshStandardMaterial({
				side: DoubleSide,
            	color: this.lut.getColor(isoValues[i]).getHex(),
				opacity,
				roughness: 0.5,
				metalness: 0.6,
				transparent: opacity < 0.99,
			});

			const mesh = new Mesh(geometry, material);
			mesh.userData = {isoValue: isoValues[i]};
			mesh.name = `Isosurface${i}`;
			this.group.add(mesh);
		}

		this.group.visible = showIsosurface;
		sm.modified();
	}

	/**
	 * Set the colormap to use
	 *
	 * @param colormapName - Name of the colormap to use
	 * @param valueMin - Minimum value for the colormap start
	 * @param valueMax - Maximum value for the colormap end
	 */
	setLut(colormapName: string, valueMin: number, valueMax: number): void {

		this.lut.setColorMap(colormapName, 512);
		this.lut.setMax(valueMax);
		this.lut.setMin(valueMin);
	}

	/**
	 * Change isosurfaces characteristics
	 *
	 * @param showIsosurface - Isosurfaces visible
	 * @param opacity - New opacity value
	 */
	changeRendering(showIsosurface: boolean, opacity: number): void {

		this.group.visible = showIsosurface;

		this.group.traverse((mesh) => {
			if(mesh.type !== "Mesh") return;
			const {isoValue: value} = mesh.userData;
			const material = (mesh as Mesh).material as MeshStandardMaterial;
			material.opacity = opacity;
			material.transparent = opacity < 0.99;
			material.color = this.lut.getColor(value as number);
		});
		sm.modified();
	}
}
