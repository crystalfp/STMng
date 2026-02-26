/**
 * Render graphical output for Trajectories.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-12-01
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import {Group, PointsMaterial, BufferGeometry, TextureLoader, type Texture,
		Points, SRGBColorSpace, Float32BufferAttribute,
		LineBasicMaterial, LineSegments} from "three";
import {sm} from "@/services/SceneManager";
import spriteImage from "@/assets/volumetric-sprite.png";
import type {PositionType} from "@/types";

/** Sprite initial size (divided by 100 so to have size in percent) */
const DEFAULT_SIZE = 50/100;

/**
 * Renderer for trajectory graphical output
 */
export class TrajectoriesRenderer {

	private readonly groupTraces = new Group();
	private readonly groupTracesName;
	private readonly groupClouds = new Group();
	private readonly groupCloudsName;
	private readonly cloudsMaterial: PointsMaterial[] = [];
	private variant = 0;
	private size = 100*DEFAULT_SIZE;

	/**
	 * Trajectory renders constructor
	 *
	 * @param id - Id of the node
	 * @param traceVisible - If the line traces should be visible
	 * @param cloudsVisible - If the line traces should be visible
	 * @param positionCloudsSize - Size of the sprites
	 */
	constructor(id: string, traceVisible: boolean, cloudsVisible: boolean,
				positionCloudsSize: number) {

		// Prepare the names of the various graphical objects
		this.groupTracesName = "Trajectories-" + id;
		this.groupCloudsName = "PositionCloud-" + id;

		// Prepare the group for the trajectories and add it to the scene
		this.groupTraces.name = this.groupTracesName;
		this.groupTraces.visible = traceVisible;
		sm.clearAndAddGroup(this.groupTraces);

		// Prepare the group for the position clouds and add it to the scene
		this.groupClouds.name = this.groupCloudsName;
		this.groupClouds.visible = cloudsVisible;
		sm.clearAndAddGroup(this.groupClouds);

		// Initialize the position clouds rendering
		// Loaded two different textures to give a minimum of non-uniformity
		// to the clouds
		const textureLoader = new TextureLoader();
		const sprite0 = textureLoader.load(spriteImage,
										  (texture: Texture): void => {
											texture.colorSpace = SRGBColorSpace;
										  });
		const sprite1 = textureLoader.load(spriteImage,
										  (texture: Texture): void => {
											texture.colorSpace = SRGBColorSpace;
											texture.flipY = false;
										  });
		this.cloudsMaterial[0] = new PointsMaterial({
			size: positionCloudsSize*DEFAULT_SIZE,
			alphaMap: sprite0,
			depthTest: false,
			transparent: true,
			color: "#000" // Will be overridden
		});
		this.cloudsMaterial[1] = new PointsMaterial({
			size: positionCloudsSize*DEFAULT_SIZE,
			alphaMap: sprite1,
			depthTest: false,
			transparent: true,
			color: "#000" // Will be overridden
		});
		this.size = positionCloudsSize*DEFAULT_SIZE;
	}

	/**
	 * Clear the accumulated structures
	 */
	resetTraces(): void {

		sm.clearGroup(this.groupTracesName);
		sm.clearGroup(this.groupCloudsName);
	}

	/**
	 * Set the size of each position cloud
	 *
	 * @param size - Cloud size
	 */
	changeSize(size: number): void {

		for(const obj of this.groupClouds.children) {
			if(obj instanceof Points) {
				(obj.material as PointsMaterial).size = size*DEFAULT_SIZE;
			}
		}
		sm.modified();
		this.size = size*DEFAULT_SIZE;
	}

	/**
	 * Set traces visibility
	 *
	 * @param visible - Trace visibility
	 * @knipIgnore
	 */
	changeTracesVisibility(visible: boolean): void {

		this.groupTraces.visible = visible;
		sm.modified();
	}

	/**
	 * Set the position clouds visibility
	 *
	 * @param visible - Visibility of the position clouds
	 */
	changeCloudsVisibility(visible: boolean): void {

		this.groupClouds.visible = visible;
		sm.modified();
	}

	/**
	 * Receive the last segment of the traces
	 *
	 * @param segments - The segments to add to the trace
	 * @param colors - Color of the various segments
	 * @param skip - If a segment should be skipped (ie it is too long or not complete)
	 * @param cloudVisibility - Visibility of the position cloud
	 */
	receiveSegments(segments: PositionType[][],
					colors: string[],
					skip: boolean[],
					cloudVisibility: boolean): void {

		// Sanity check
		const len = colors.length;
		if(len === 0) return;

		// Group segments of the same color
		const entries = [];
		for(let idx=0; idx < len; ++idx) {

			entries.push({idx, color: colors[idx], skip: skip[idx]});
		}
		const groups = Object.groupBy(entries, ({color}) => color);

		// For each color
		for(const group in groups) {

			// Get begin/end points for the valid segments
			const points = [];
			const cloudPoints = [];
			for(const entry of groups[group]!) {

				const segment = segments[entry.idx];
				if(entry.skip) {
					if(segment.length === 1) {
						cloudPoints.push(segment[0][0], segment[0][1], segment[0][2]);
					}
					continue;
				}
				points.push(segment[0][0], segment[0][1], segment[0][2],
							segment[1][0], segment[1][1], segment[1][2]);
				cloudPoints.push(segment[1][0], segment[1][1], segment[1][2]);
			}
			const geometry = new BufferGeometry();
			geometry.setAttribute("position",
								  new Float32BufferAttribute(points, 3));
			const material = new LineBasicMaterial({color: group});
			const line = new LineSegments(geometry, material);
			this.groupTraces.add(line);

			const volumeGeometry = new BufferGeometry();
			volumeGeometry.setAttribute("position",
										new Float32BufferAttribute(cloudPoints, 3));
			const volumeMaterial = this.cloudsMaterial[this.variant].clone();
			this.variant = (this.variant + 1) % 2;
			volumeMaterial.color.set(group);
			volumeMaterial.size = this.size;
			const particles = new Points(volumeGeometry, volumeMaterial);
			this.groupClouds.add(particles);
		}
		sm.modified();

		// Set clouds visibility
		this.groupClouds.visible = cloudVisibility;
	}
}
