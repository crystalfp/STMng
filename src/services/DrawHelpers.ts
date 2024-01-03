
import * as THREE from "three";
import {CSS3DObject} from "three/addons/renderers/CSS3DRenderer.js";
import {sb, type UiParams} from "@/services/Switchboard";

export class DrawHelpers {

	private showAxis = true;
	private showGrid = true;
	private readonly scene;

	constructor(private readonly id: string) {

		this.scene = sb.accessScene();
		const grid = this.gridHelper();
		this.scene.add(grid);
		const axis = this.axisHelper();
		this.scene.add(axis);

		sb.getUiParams(this.id, (params: UiParams) => {

    		this.showAxis = params.showAxis as boolean ?? true;
    		this.showGrid = params.showGrid as boolean ?? true;

			grid.visible = this.showGrid;
			axis.visible = this.showAxis;
			axis.traverse((ob) => {
				if(ob.type === "Object3D") ob.visible = this.showAxis;
			});
		});
	}

	private axisHelper(): THREE.Group {

		const group = new THREE.Group();
		group.name = "AxisHelper";

		const originZero = new THREE.Vector3(0, 0, 0);
		const arrowX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0),
													originZero, 1,
													0xFF0000, 0.4, 0.2);
		const arrowY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0),
													originZero, 1,
													0x00FF00, 0.4, 0.2);
		const arrowZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1),
													originZero, 1,
													0x0000FF, 0.4, 0.2);
		group.add(arrowX, arrowY, arrowZ);

		const textX = document.createElement("div");
		textX.style.color = "#FF0000";
		textX.textContent = "x";
		textX.style.fontSize = "1px";
		textX.style.backgroundColor = "transparent";

		const labelX = new CSS3DObject(textX);
		labelX.position.set(1.3, 0, 0);

		const textY = document.createElement("div");
		textY.style.color = "#00FF00";
		textY.textContent = "y";
		textY.style.fontSize = "10px";
		textY.style.backgroundColor = "transparent";

		const labelY = new CSS3DObject(textY);
		labelY.position.set(0, 1.5, 0);
		labelY.scale.set(0.05, 0.05, 1);

		const textZ = document.createElement("div");
		textZ.style.color = "#0000FF";
		textZ.textContent = "z";
		textZ.style.fontSize = "1px";
		textZ.style.backgroundColor = "transparent";

		const labelZ = new CSS3DObject(textZ);
		labelZ.position.set(0, 0, 1.1);

		group.add(labelX, labelY, labelZ);

		return group;
	}

	private gridHelper(): THREE.GridHelper {
		const grid = new THREE.GridHelper(10, 10);
		grid.name = "GridHelper";

		return grid;
	}
}
