/**
 * Simple 3D viewer for non-main viewers.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-10-08
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {onMounted, onBeforeUnmount} from "vue";
import CameraControls from "camera-controls";
import {Scene, Color, PerspectiveCamera, WebGLRenderer, DirectionalLight,
        AmbientLight, OrthographicCamera, Vector3, Vector2, type Group,
        Raycaster, Vector4, Quaternion, Matrix4, Spherical,
        Box3, Sphere, MathUtils, Timer, Mesh} from "three";

/** Simple 3D viewer */
export class SimpleViewer {

	private readonly scene = new Scene();
	private resizeObserver: ResizeObserver | undefined;
	/** The canvas sizes (will be computed during mount or resize) */
	private canvasWidth = 500;
	private canvasHeight = 500;
	private camera: PerspectiveCamera | OrthographicCamera | undefined;
	private renderer: WebGLRenderer | undefined;
	private controls: CameraControls | undefined;
    private isSceneModified = true;
    private retry = 0;
	private readonly isPerspective: boolean;

	/**
	 * Create the simple viewer 3D
	 *
	 * @param containerSelector - CSS Selector of the viewer container
	 * @param isPerspective - True for a perspective viewer, otherwise orthographic
	 * @param extraOnMounted - Optional routine to be called during onMounted phase
	 */
	constructor(containerSelector: string,
				isPerspective: boolean,
				extraOnMounted?: (scene: Scene) => void) {

		this.isPerspective = isPerspective;

		onMounted(() => {

			// Access the viewer container
			const container = document.querySelector<HTMLElement>(containerSelector);
			if(!container) return;

			this.resizeObserver = new ResizeObserver((entries) => {

				for(const entry of entries) {
					this.canvasWidth = entry.borderBoxSize[0].inlineSize;
					this.canvasHeight = entry.borderBoxSize[0].blockSize;
				}

				if(this.isPerspective) {
					const camera = this.camera as PerspectiveCamera;
					camera.aspect = this.canvasWidth/this.canvasHeight;
				}
				else {
					const camera = this.camera as OrthographicCamera;
					const hh = 10;
					const hw = hh * this.canvasWidth/this.canvasHeight;
					camera.left   = -hw;
					camera.right  =  hw;
					camera.top    =  hh;
					camera.bottom = -hh;
				}
				this.camera!.updateProjectionMatrix();
				this.renderer!.setSize(this.canvasWidth, this.canvasHeight);
				this.setSceneModified();
			});

			this.init(container);
			this.resizeObserver.observe(container);
			if(extraOnMounted) extraOnMounted(this.scene);
		});

		onBeforeUnmount(() => {

			this.resizeObserver!.disconnect();
			// eslint-disable-next-line unicorn/no-null
			this.renderer!.setAnimationLoop(null);
			this.renderer!.dispose();
		});
	}

	/**
	 * Initialize the viewer in the given container
	 *
	 * @param container - Viewer container
	 */
	private init(container: HTMLElement): void {

		this.scene.background = new Color("#90CEEC");

		if(this.isPerspective) {
			this.camera = new PerspectiveCamera(30, this.canvasWidth/this.canvasHeight);
			// this.camera.position.set(1.7, 2.1, 1.9);
			this.camera.position.set(20, 20, 20);
		}
		else {
			const hh = 10;
			const hw = hh * this.canvasWidth/this.canvasHeight;
			this.camera = new OrthographicCamera(-hw, hw, hh, -hh, 0.1, 500);
			this.camera.position.set(11.6, 12.8, 11.4);
			// this.camera.position.set(7.7, 8.5, 7.6);
			this.camera.zoom = 1;
		}
		this.camera.lookAt(this.scene.position);

		this.renderer = new WebGLRenderer({antialias: true, powerPreference: "high-performance"});
		this.renderer.setSize(this.canvasWidth, this.canvasHeight);
		document.body.append(this.renderer.domElement);
		container.append(this.renderer.domElement);

		// Add mouse controls to move the camera
		const subsetOfTHREE = {OrthographicCamera, Vector3, Vector2,
							   WebGLRenderer, Raycaster, Vector4, Quaternion,
							   Matrix4, Spherical, Box3, Sphere, MathUtils};
		CameraControls.install({THREE: subsetOfTHREE});
		this.controls = new CameraControls(this.camera, this.renderer.domElement);

		const light = new DirectionalLight("white", 3);
		light.position.set(0, 1, 0);
		this.scene.add(light);
		const ambient = new AmbientLight("#BBBBBB", 1);
		this.scene.add(ambient);

		// Rendering function for the run
		const clock = new Timer();
		clock.connect(document);
		const animationLoop = (): void => {

			clock.update();
			const doRender = this.controls!.update(clock.getDelta());
			if(doRender || this.needRendering()) {

				light.position.copy(this.camera!.position);
				this.renderer!.render(this.scene, this.camera!);
			}
		};
		this.renderer.setAnimationLoop(animationLoop);
	}

	/**
	 * Get the scene
	 *
	 * @returns The scene
	 */
	getScene(): Scene {
		return this.scene;
	}

	/**
     * Ask if the scene needs rendering because has been changed,
     * then reset the modified flag
     *
     * @returns True if the scene should be rendered
     */
    private needRendering(): boolean {

        if(this.isSceneModified) {
            if(this.retry > 2) {
                this.isSceneModified = false;
                this.retry = 0;
            }
            ++this.retry;
            return true;
        }
        return false;
    }

    /**
     * Mark the scene as modified
     */
    setSceneModified(): void {
        this.isSceneModified = true;
    }

	/**
	 * Center camera and controls
	 *
	 * @param center - Coordinates of the center of the structure
	 * @param zoom - Camera zoom value
	 */
	centerCamera(center: [number, number, number], zoom=1): void {

		if(!this.camera || !this.controls) return;

		this.camera.lookAt(new Vector3(...center));
		this.controls.setOrbitPoint(...center);
		const maxSide = Math.max(center[0], center[1], center[2]);
		void this.controls
				.normalizeRotations()
				.setLookAt(center[0], center[1], center[2] + 2*maxSide,
						   center[0], center[1], center[2], false);
		void this.controls.zoomTo(zoom, false);

		this.camera.updateProjectionMatrix();
	}

	/**
	 * Set camera position and look-at point
	 *
	 * @param position - Camera position to be set
	 * @param target - Camera look at point
	 * @param zoom - Camera zoom
	 */
	setCamera(position: [number, number, number],
			  target: [number, number, number],
			  zoom=1): void {

		if(!this.camera || !this.controls) return;

		this.camera.position.set(position[0], position[1], position[2]);
		this.camera.lookAt(new Vector3(...target));

		this.controls.setOrbitPoint(...target);
		void this.controls
				.normalizeRotations()
				.setLookAt(position[0], position[1], position[2],
						   target[0], target[1], target[2], false);
		void this.controls.zoomTo(zoom, false);

		this.camera.updateProjectionMatrix();
	}

	/**
	 * Center camera and controls using scene bounding sphere
	 *
	 * @param atomsGroup - Structure visualized
	 * @param zoom - Camera zoom value
	 */
	positionCamera(atomsGroup: Group, zoom=1): void {

		if(!this.camera || !this.controls) return;

		const boundingBox = new Box3().setFromObject(atomsGroup);
		const boundingSphere = boundingBox.getBoundingSphere(new Sphere());
		const sphereCenter = boundingSphere.center;
		const center = [sphereCenter.x, sphereCenter.y, sphereCenter.z];
		const radius = boundingSphere.radius;

		this.camera.lookAt(sphereCenter);
		this.camera.position.set(center[0]+radius, center[1]+radius, center[2]+radius);

		this.controls.setOrbitPoint(center[0], center[1], center[2]);
		void this.controls
				.normalizeRotations()
				.setLookAt(center[0]+radius, center[1]+radius, center[2]+radius,
						   center[0], center[1], center[2], false);
		void this.controls.zoomTo(zoom, false);
		this.controls.azimuthAngle = 0;

		this.camera.updateProjectionMatrix();
	}

	/**
	 * Empty a group with the given name
	 *
	 * @param groupName - Name of the group to be cleared
	 * @param removeGroup - If true remove also the group itself from the scene
	 */
	clearGroup(groupName: string, removeGroup=false): void {

		const group = this.scene.getObjectByName(groupName);
		if(!group) return;

		// Meshes to be delete from the group
		const meshes: Mesh[] = [];

		// Remove meshes' parts
		group.traverse((object) => {

			if(object.type === "Group") return;

			const mesh = object as Mesh;
			if(mesh.geometry) mesh.geometry.dispose();
			if(mesh.material) {
				if(Array.isArray(mesh.material)) {
					for(const material of mesh.material) material.dispose();
				}
				else {
					mesh.material.dispose();
				}
			}
			meshes.push(mesh);
		});

		// Clear the group
		for(const mesh of meshes) {group.remove(mesh);}
        group.clear();

		// Remove the group itself
		if(removeGroup) this.scene.remove(group);
		this.isSceneModified = true;
	}
}
