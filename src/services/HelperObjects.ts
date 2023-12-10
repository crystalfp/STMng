
import * as THREE from "three";
import {CSS3DObject} from "three/addons/renderers/CSS3DRenderer.js";
// import {TextGeometry} from "three/addons/geometries/TextGeometry.js";
// import {FontLoader} from "three/addons/loaders/FontLoader.js";
// import {Text} from "troika-three-text";
import {createMaterial, createColorTextureMaterial, getQuality} from "@/services/DefineMaterials";
import {watchEffect} from "vue";
import {useConfigStore} from "@/stores/configStore";

const axisHelper = (): THREE.Group => {

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
/*
	const loader = new FontLoader();

	// loader.load("node_modules/three/examples/fonts/helvetiker_regular.typeface.json", (font) => {
	loader.load("/helvetiker_regular.typeface.json", (font) => {
		const meshMaterial = createMaterial("white");
		const gX = new TextGeometry("x", {
			font,
			size: 0.2,
			height: 0.02,
			curveSegments: 12,
			bevelEnabled: false,
		});
		const mX = new THREE.Mesh(gX, meshMaterial);
		mX.position.set(1, 0, 0);
		const gY = new TextGeometry("y", {
			font,
			size: 0.2,
			height: 0.02,
			curveSegments: 12,
			bevelEnabled: false,
		});
		const mY = new THREE.Mesh(gY, meshMaterial);
		mY.position.set(0, 1, 0);

		const gZ = new TextGeometry("z", {
			font,
			size: 0.2,
			height: 0.02,
			curveSegments: 12,
			bevelEnabled: false,
		});
		const mZ = new THREE.Mesh(gZ, meshMaterial);
		mZ.position.set(0, 0, 1);

		scene.add(mX, mY, mZ);
	});
*/
	// const tttx = new Text();
	// tttx.text = "Hello world!";
	// tttx.fontSize = 0.2;
	// tttx.color = 0x9966FF;

	// scene.add(tttx);

	// // Update the rendering:
	// tttx.sync();

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
};

export const createAxisHelper = (scene: THREE.Scene): void => {

	const configStore = useConfigStore();
    if(configStore.scene.showAxis) scene.add(axisHelper());
    watchEffect(() => {
        const obj = scene.getObjectByName("AxisHelper");
        if(obj) {
            if(configStore.scene.showAxis) return;
            // Remove object
            obj.traverse((subObj: THREE.Object3D) => {
                if(subObj.type === "ArrowHelper") (subObj as THREE.ArrowHelper).dispose();
            });
            scene.remove(obj);
            obj.clear();
        }
        else if(configStore.scene.showAxis) scene.add(axisHelper());
    });
};

const gridHelper = (): THREE.GridHelper => {
	const grid = new THREE.GridHelper(10, 10);
	grid.name = "GridHelper";

	return grid;
};

export const createGridHelper = (scene: THREE.Scene): void => {
	const configStore = useConfigStore();
    if(configStore.scene.showGrid) scene.add(gridHelper());
    watchEffect(() => {
        const obj = scene.getObjectByName("GridHelper");
        if(obj) {
            if(configStore.scene.showGrid) return;
            scene.remove(obj);
            (obj as THREE.GridHelper).dispose();
            obj.clear();
        }
        else if(configStore.scene.showGrid) scene.add(gridHelper());
    });
};

const sphereSubdivisions = [2, 4, 6, 10];
export const createSphere = (radius: number, color: THREE.ColorRepresentation,
							 position: [number, number, number]): THREE.Mesh => {

	const subdivisions = sphereSubdivisions[getQuality()];
	const geometry = new THREE.IcosahedronGeometry(radius, subdivisions);
	const meshMaterial = createMaterial(color);
	const sphere = new THREE.Mesh(geometry, meshMaterial);
	sphere.position.set(position[0], position[1], position[2]);
	return sphere;
};

const cubeSubdivisions = [1, 2, 8, 16];
export const createCube = (sides: [number, number, number], color: THREE.ColorRepresentation,
						   position: [number, number, number]): THREE.Mesh => {

	const subdivisions = cubeSubdivisions[getQuality()];
	const geometry = new THREE.BoxGeometry(sides[0], sides[1], sides[2],
										   subdivisions, subdivisions, subdivisions);
	const meshMaterial = createMaterial(color);
	const cube = new THREE.Mesh(geometry, meshMaterial);
	cube.position.set(position[0], position[1], position[2]);
	return cube;
};

const vectorToQuaternion = (nx: number, ny: number, nz: number): THREE.Quaternion => {

    const forward = new THREE.Vector3(nx, ny, nz);
    const direction = new THREE.Vector3(0, 1, 0);

    const cosTheta = forward.dot(direction);
    const axis = new THREE.Vector3(0, 0, 0);

    if(cosTheta < -0.999) {
        // special case when vectors in opposite directions:
        // there is no "ideal" rotation axis
        // So guess one; any will do as long as it's perpendicular to start
        axis.crossVectors(new THREE.Vector3(0, 0, 1), forward);

        if(axis.length() * axis.length() < 0.01) {
            axis.crossVectors(new THREE.Vector3(1, 0, 0), forward);
        }
        axis.normalize();
        return new THREE.Quaternion(axis.x, axis.y, axis.z, 0);
    }

    axis.crossVectors(forward, direction);

    const es = Math.sqrt((1 + cosTheta) * 2);
    const invEs = 1 / es;

    return new THREE.Quaternion(
        axis.x * invEs,
        axis.y * invEs,
        axis.z * invEs,
        es * 0.5
    );
};

const cylinderSubdivisions = [4, 8, 16, 32];
export const createCylinder = (start: [number, number, number], end: [number, number, number],
							   radius: number, colorStart: THREE.ColorRepresentation,
							   colorEnd: THREE.ColorRepresentation): THREE.Mesh => {

	const subdivisions = cylinderSubdivisions[getQuality()];

	const dx = start[0] - end[0];
	const dy = start[1] - end[1];
	const dz = start[2] - end[2];
	const len = Math.hypot(dx, dy, dz);
	const geometry = new THREE.CylinderGeometry(radius, radius, len, subdivisions, 1, true);
	const meshMaterial = createColorTextureMaterial(new THREE.Color(colorStart),
													new THREE.Color(colorEnd), subdivisions);
	const cylinder = new THREE.Mesh(geometry, meshMaterial);

	const midx = (start[0] + end[0])/2;
	const midy = (start[1] + end[1])/2;
	const midz = (start[2] + end[2])/2;
	cylinder.position.set(midx, midy, midz);
	cylinder.applyQuaternion(vectorToQuaternion(dx/len, -dy/len, dz/len));
	// const start = new THREE.Vector3(...obj.start);
	// const end = new THREE.Vector3(...obj.end);
	// cylinder.position.copy(start);
	// cylinder.position.lerp(end, 0.5);
	// cylinder.scale.set(1, start.distanceTo(end), 1);
	// cylinder.lookAt(obj.end[0], obj.end[1], obj.end[2]);
	return cylinder;
};
