/**
 * Measure interatomic distances and angles
 *
 * @packageDocumentation
 */
import * as THREE from "three";
import {watch} from "vue";
import {sm} from "@/services/SceneManager";
import {sb} from "@/services/Switchboard";
import {useControlStore} from "@/stores/controlStore";
import {useConfigStore} from "@/stores/configStore";
import type {Structure} from "@/types";
import {atomData} from "@/services/AtomInfo";

const labels = ["Atom A:", "Atom B:", "Atom C:"];
const colors = ["#FF0000", "#00FF00", "#4263FF"];

export class Measures {

	private inputStructure: Structure | undefined;
	private readonly group = new THREE.Group();
	private readonly groupName;

	/**
	 * Create the node
	 *
	 * @param id - ID of the Structure Reader node
	 */
	constructor(private readonly id: string) {

		this.groupName = `AtomSelectors-${this.id}`;
		this.group.name = this.groupName;
		sm.add(this.group);

		const controlStore = useControlStore();

		sb.getData(this.id, (data: unknown) => {

			controlStore.deselectAtoms();
			controlStore.deselectPolyhedron();
			sm.clearGroup(this.groupName);

			this.inputStructure = data as Structure;
		});

		watch(controlStore, () => {

			sm.clearGroup(this.groupName);

			// Has been selected a polyhedron, not an atom
			if(controlStore.polyhedronNewIdx !== undefined) {

				let objectCurrent: THREE.Mesh;
				let objectNew: THREE.Mesh;
				sm.scene.traverse((object) => {
					if(object.name === "Polyhedron") {
						if(object.userData.idx === controlStore.polyhedronNewIdx) {
							objectNew = object as THREE.Mesh;
					   	}
					   	if(object.userData.idx === controlStore.polyhedronCurrentIdx) {
							objectCurrent = object as THREE.Mesh;
						}
					}
				});

				// Click on the same poly deselect it
				if(controlStore.polyhedronNewIdx === controlStore.polyhedronCurrentIdx) {

					(objectCurrent!.material as THREE.MeshLambertMaterial).color =
						new THREE.Color(controlStore.polyhedronCurrentColor);
					controlStore.polyhedronCurrentIdx = undefined;
					controlStore.polyhedronNewIdx = undefined;
					sb.setUiParams(this.id, {
						distanceAB: "",
						distanceBC: "",
						distanceAC: "",
						angleABC: "",
						details: "[]",
						volume: 0
					});
				}
				else {
					// Deselect current selection
					if(controlStore.polyhedronCurrentIdx !== undefined) {

						(objectCurrent!.material as THREE.MeshLambertMaterial).color =
							new THREE.Color(controlStore.polyhedronCurrentColor);
						controlStore.polyhedronCurrentIdx = undefined;
					}

					// Select new poly
					(objectNew!.material as THREE.MeshLambertMaterial).color = new THREE.Color("#FF0000");

					// Move the control to the new poly
					controlStore.polyhedronCurrentIdx = controlStore.polyhedronNewIdx;
					controlStore.polyhedronCurrentColor = controlStore.polyhedronNewColor;
					controlStore.polyhedronNewIdx = undefined;

					const positions = objectNew!.geometry.getAttribute("position");
					const volume = this.computeVolume(positions.array, positions.count);

					sb.setUiParams(this.id, {
						distanceAB: "",
						distanceBC: "",
						distanceAC: "",
						angleABC: "",
						details: "[]",
						volume
					});
				}

				return;
			}

			const selections = controlStore.atomsSelected;

			if(!this.inputStructure ||
				this.inputStructure.atoms.length === 0 ||
				selections.length === 0) {

				sb.setUiParams(this.id, {
					distanceAB: "",
					distanceBC: "",
					distanceAC: "",
					angleABC: "",
					details: "[]",
					volume: 0
				});
				return;
			}
			const out = [];
			const {atoms} = this.inputStructure;

			const configStore = useConfigStore();
			const isPerspective = configStore.camera.type === "perspective";
			const pointSize = isPerspective ? 0.3 : 6;
			let i = 0;
			for(const idx of selections) {

				const {atomZ, position} = atoms[idx];
				const {symbol, rCov} = atomData(atomZ);
				const coords = `[${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}]`;
				out.push({index: idx, label: labels[i], symbol, color: colors[i], coords});

				const geom = new THREE.IcosahedronGeometry(rCov*0.6, 4);
				const mat = new THREE.PointsMaterial({color: colors[i], size: pointSize});
				const points = new THREE.Points(geom, mat);
				points.position.set(position[0], position[1], position[2]);
				this.group.add(points);

				++i;
			}

			let distanceAB = "";
			let distanceBC = "";
			let distanceAC = "";
			let angleABC = "";
			let dx1 = 0;
			let dy1 = 0;
			let dz1 = 0;
			let dist1 = 1;

			if(selections.length > 1) {

				// Compute distance between atoms
				const idxA = selections[0];
				const idxB = selections[1];
				dx1 = atoms[idxA].position[0] - atoms[idxB].position[0];
				dy1 = atoms[idxA].position[1] - atoms[idxB].position[1];
				dz1 = atoms[idxA].position[2] - atoms[idxB].position[2];

				dist1 = Math.hypot(dx1, dy1, dz1);
				distanceAB = dist1.toPrecision(5);
			}
			if(selections.length > 2) {

				// Compute distance between atoms
				const idxB = selections[1];
				const idxC = selections[2];
				const dx = atoms[idxC].position[0] - atoms[idxB].position[0];
				const dy = atoms[idxC].position[1] - atoms[idxB].position[1];
				const dz = atoms[idxC].position[2] - atoms[idxB].position[2];

				const dist = Math.hypot(dx, dy, dz);
				distanceBC = dist.toPrecision(5);

				const dotProduct = dx1*dx+dy1*dy+dz1*dz;
				const angle = Math.acos(dotProduct/(dist1*dist))*180/Math.PI;
				angleABC = angle.toPrecision(5);

				// Compute distance between atoms
				const idxA = selections[0];
				const dx3 = atoms[idxA].position[0] - atoms[idxC].position[0];
				const dy3 = atoms[idxA].position[1] - atoms[idxC].position[1];
				const dz3 = atoms[idxA].position[2] - atoms[idxC].position[2];

				const dist3 = Math.hypot(dx3, dy3, dz3);
				distanceAC = dist3.toPrecision(5);
			}

			sb.setUiParams(this.id, {
					distanceAB,
					distanceBC,
					distanceAC,
					angleABC,
					details: JSON.stringify(out),
					volume: 0
			});
		});
	}

	/**
	 * Compute the polyhedron volume using the formula found here:
	 * https://mathworld.wolfram.com/PolyhedronVolume.html
	 *
	 * @param vertices - Polyhedron geometry vertices coordinates.
	 *					 Each three consecutive vertices form a triangle
	 * @param numberVertices - Total number of vertices
	 */
	private computeVolume(vertices: THREE.TypedArray, numberVertices: number): number {

		let volume = 0;
		for(let i=0; i < numberVertices/3; ++i) {

			const startIdx = i*9;

			const vu = [
				vertices[startIdx+3] - vertices[startIdx],
				vertices[startIdx+4] - vertices[startIdx+1],
				vertices[startIdx+5] - vertices[startIdx+2]
			];
			const vv = [
				vertices[startIdx+6] - vertices[startIdx],
				vertices[startIdx+7] - vertices[startIdx+1],
				vertices[startIdx+8] - vertices[startIdx+2]
			];
			const normal = [
				vu[1] * vv[2] - vu[2] * vv[1],
				vu[2] * vv[0] - vu[0] * vv[2],
				vu[0] * vv[1] - vu[1] * vv[0]
			];

			volume += vertices[startIdx]*normal[0] +
					  vertices[startIdx+1]*normal[1] +
					  vertices[startIdx+2]*normal[2];
		}

		// Compute volume
		return volume/6;
	}
}
