/**
 * Render graphical output for Trajectories.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-12-01
 */
import {Group, PointsMaterial, BufferGeometry, TextureLoader, type Texture, Points,
		SRGBColorSpace, Float32BufferAttribute, Vector3,
		LineBasicMaterial, Line, LineSegments} from "three";
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
	private readonly cloudsMaterial: PointsMaterial;

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
		const textureLoader = new TextureLoader();
		const sprite = textureLoader.load(spriteImage,
										  (texture: Texture): void => {
											texture.colorSpace = SRGBColorSpace;
										  });
		this.cloudsMaterial = new PointsMaterial({
			size: positionCloudsSize*DEFAULT_SIZE,
			alphaMap: sprite,
			depthTest: false,
			transparent: true,
			color: "#000" // Will be overridden
		});
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
				sm.modified();
			}
		}
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
	 * Receive a set of traces
	 *
	 * @param segments - List of coordinates arrays for each trace segment
	 * @param colors - Color of each segment
	 * @param cloudVisibility - Visibility of the position cloud
	 */
	receiveTraces(segments: number[][], colors: string[], cloudVisibility: boolean): void {

		sm.clearGroup(this.groupTracesName);
		sm.clearGroup(this.groupCloudsName);

		let idx = 0;
		for(const segment of segments) {

			const points: Vector3[] = [];
			const len = segment.length;
			for(let i=0; i < len; i+=3) {
				points.push(new Vector3(segment[i], segment[i+1], segment[i+2]));
			}

			const geometry = new BufferGeometry().setFromPoints(points);
			const material = new LineBasicMaterial({color: colors[idx]});
			const line = new Line(geometry, material);
			this.groupTraces.add(line);
			++idx;
		}

		// Set clouds visibility and populate it if visible
		this.changeCloudsVisibility(cloudVisibility);
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

		// Group segments of the same color
		let idx = 0;
		const entries = [];
		for(const color of colors) {

			entries.push({idx, color, skip: skip[idx]});
			++idx;
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
			const volumeMaterial = this.cloudsMaterial.clone();
			volumeMaterial.color.set(group);
			const particles = new Points(volumeGeometry, volumeMaterial);
			this.groupClouds.add(particles);
		}

		// Set clouds visibility
		this.groupClouds.visible = cloudVisibility;
	}
}
