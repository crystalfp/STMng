/**
 * Simple 3D viewer for non-main viewers.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-10-08
 */
import {onMounted, onBeforeUnmount} from "vue";
import CameraControls from "camera-controls";
import {Scene, Color, PerspectiveCamera, WebGLRenderer, DirectionalLight,
        AmbientLight, OrthographicCamera, Vector3, Vector2,
        Raycaster, Vector4, Quaternion, Matrix4, Spherical,
        Box3, Sphere, MathUtils, Clock} from "three";

export class SimpleViewer {

	private readonly scene = new Scene();
	private resizeObserver: ResizeObserver | undefined;
	private canvasWidth = 500;
	private canvasHeight = 500;
	private camera: PerspectiveCamera | undefined;
	private renderer: WebGLRenderer | undefined;
    private isSceneModified = true;
    private retry = 0;
	private readonly isPerspective: boolean;


	constructor(container: HTMLElement,
				isPerspective: boolean,
				extraOnMounted?: (scene: Scene) => void) {

		this.isPerspective = isPerspective;
		void this.isPerspective; // TBD

		onMounted(() => {

			this.resizeObserver = new ResizeObserver((entries) => {

				for(const entry of entries) {
					if(entry.borderBoxSize) {
						this.canvasWidth = entry.borderBoxSize[0].inlineSize;
						this.canvasHeight = entry.borderBoxSize[0].blockSize;
					}
					else {
						this.canvasWidth = entry.contentRect.width;
						this.canvasHeight = entry.contentRect.height;
					}
				}

				this.camera!.aspect = this.canvasWidth/this.canvasHeight;
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

	private init(dom: HTMLElement): void {

		this.scene.background = new Color("#90CEEC");

		const camera = new PerspectiveCamera(30, this.canvasWidth/this.canvasHeight);
		camera.position.set(1.7, 2.1, 1.9);
		camera.lookAt(this.scene.position);

		const renderer = new WebGLRenderer({antialias: true, powerPreference: "high-performance"});
		renderer.setSize(this.canvasWidth, this.canvasHeight);
		document.body.append(renderer.domElement);
		dom.append(renderer.domElement);

		// Add mouse controls to move the camera
		const subsetOfTHREE = {OrthographicCamera, Vector3, Vector2, WebGLRenderer,
							Raycaster, Vector4, Quaternion, Matrix4, Spherical,
							Box3, Sphere, MathUtils};
		CameraControls.install({THREE: subsetOfTHREE});
		const controls = new CameraControls(camera, renderer.domElement);

		const light = new DirectionalLight("white", 3);
		light.position.set(0, 1, 0);
		this.scene.add(light);
		const ambient = new AmbientLight("#BBBBBB", 1);
		this.scene.add(ambient);

		// Rendering function for the run
		const clock = new Clock();
		const animationLoop = (): void => {

			const doRender = controls.update(clock.getDelta());
			if(doRender || this.needRendering()) {

				light.position.copy(camera.position);
				renderer.render(this.scene, camera);
			}
		};
		renderer.setAnimationLoop(animationLoop);
	}

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
}
