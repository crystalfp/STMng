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
		LineBasicMaterial, Line} from "three";
import {sm} from "@/services/SceneManager";
import spriteImage from "@/assets/volumetric-sprite.png";

/**
 * Set colorspace on the loaded texture
 *
 * @param texture - Loaded texture
 */
const setColorSpace = (texture: Texture): void => {

	texture.colorSpace = SRGBColorSpace;
};

/**
 * Renderer for trajectory graphical output
 */
export class TrajectoriesRenderer {

	private readonly group = new Group();
	private readonly groupName;
	private readonly volumeName;
	private readonly markerName;
	private volumeMaterial: PointsMaterial | undefined;
	private readonly volumeVertices: number[] = [];
	private readonly volumeGeometry = new BufferGeometry();
	private readonly markers = new Group();

	/**
	 * Trajectory renders constructor
	 *
	 * @param id - Id of the node
	 * @param traceVisible - If the line traces should be visible
	 * @param positionCloudsSize - Size of the sprites
	 * @param positionCloudsColor - Initial color of the sprites
	 */
	constructor(id: string, traceVisible: boolean,
				positionCloudsSize: number, positionCloudsColor: string) {

		// Prepare the names of the various graphical objects
		this.groupName = "Trajectories-" + id;
		this.volumeName = "PositionCloud-" + id;
		this.markerName = "AveragePosition-" + id;

		// Prepare the group for the trajectories and add it to the scene
		this.group.name = this.groupName;
		this.group.visible = traceVisible;
		sm.clearAndAddGroup(this.group);

		// The group for the average positions markers
		this.markers.name = this.markerName;
		sm.clearAndAddGroup(this.markers);

		// Initialize the position clouds rendering
		this.initializeVolume(positionCloudsSize, positionCloudsColor);
	}

	/**
	 * Initialize the positionCloud material
	 *
	 * @param positionCloudsSize - Size of each position cloud
	 * @param positionCloudsColor - Base color of the position clouds
	 */
	private initializeVolume(positionCloudsSize: number, positionCloudsColor: string): void {

		const textureLoader = new TextureLoader();

		const sprite = textureLoader.load(spriteImage, setColorSpace);

		this.volumeMaterial = new PointsMaterial({
			size: positionCloudsSize,
			alphaMap: sprite,
			depthTest: false,
			transparent: true,
			color: positionCloudsColor
		});

		this.volumeVertices.length = 0;
		sm.modified();
	}

	/**
	 * Create the position clouds
	 */
	private populateVolume(): void {

		sm.deleteMesh(this.volumeName);
		if(this.volumeVertices.length === 0 || !this.volumeMaterial) return;

		this.volumeGeometry.setAttribute("position",
										 new Float32BufferAttribute(this.volumeVertices, 3));
		const particles = new Points(this.volumeGeometry, this.volumeMaterial.clone());
		particles.name = this.volumeName;
		sm.add(particles);
	}

	/**
	 * Clear the accumulated structures
	 */
	resetTraces(): void {

		sm.clearGroup(this.groupName);
		sm.deleteMesh(this.volumeName);
		this.volumeVertices.length = 0;
	}

	/**
	 * Set the position cloud color
	 *
	 * @param color - The color for the position clouds
	 */
	changeColor(color: string): void {

		if(this.volumeMaterial) {

			this.volumeMaterial.color.set(color);
			sm.modified();
		}
	}

	/**
	 * Set the size of each position cloud
	 *
	 * @param size - Cloud size
	 */
	changeSize(size: number): void {

		if(this.volumeMaterial) {

			this.volumeMaterial.size = size;
			sm.modified();
		}
	}

	/**
	 * Set the position clouds visibility
	 *
	 * @param visible - Visibility of the position clouds
	 */
	changeCloudsVisibility(visible: boolean): void {

		if(visible) this.populateVolume();
		else sm.deleteMesh(this.volumeName);
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

		sm.clearGroup(this.groupName);

		this.volumeVertices.length = 0;

		let idx = 0;
		for(const segment of segments) {

			const points: Vector3[] = [];
			const len = segment.length;
			for(let i=0; i < len; i+=3) {
				points.push(new Vector3(segment[i], segment[i+1], segment[i+2]));
				this.volumeVertices.push(segment[i], segment[i+1], segment[i+2]);
			}

			const geometry = new BufferGeometry().setFromPoints(points);
			const material = new LineBasicMaterial({color: colors[idx]});
			const line = new Line(geometry, material);
			this.group.add(line);
			++idx;
		}

		// Set clouds visibility and populate it if visible
		this.changeCloudsVisibility(cloudVisibility);
	}

	/**
	 * Set traces visibility
	 *
	 * @param visible - Trace visibility
	 * @knipIgnore
	 */
	setVisibility(visible: boolean): void {

		this.group.visible = visible;
		sm.modified();
	}
}
