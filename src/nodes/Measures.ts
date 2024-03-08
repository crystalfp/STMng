/**
 * Measure interatomic distances and angles
 *
 * @packageDocumentation
 */
import * as THREE from "three";
import {watchEffect} from "vue";
import {sm} from "@/services/SceneManager";
import {sb} from "@/services/Switchboard";
import {useConfigStore} from "@/stores/configStore";
import type {Structure} from "@/types";

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

		sb.getData(this.id, (data: unknown) => {

			const configStore = useConfigStore();
			configStore.deselectAtoms();
			sm.clearGroup(this.groupName);

			this.inputStructure = data as Structure;
		});

		watchEffect(() => {

			sm.clearGroup(this.groupName);

			const configStore = useConfigStore();
			const selections = configStore.control.atomsSelected;
			if(!this.inputStructure ||
				this.inputStructure.atoms.length === 0 ||
				selections.length === 0) {

				sb.setUiParams(this.id, {
					distanceAB: "",
					distanceBC: "",
					distanceAC: "",
					angleABC: "",
					details: "[]"
				});
				return;
			}
			const out = [];
			const {atoms, look} = this.inputStructure;

			let i = 0;
			for(const idx of selections) {

				const {atomZ, position} = atoms[idx];
				const {symbol, rCov} = look[atomZ];
				out.push({index: idx, label: labels[i], symbol, color: colors[i]});

				const geom = new THREE.IcosahedronGeometry(rCov*0.6, 4);
				const mat = new THREE.PointsMaterial({color: colors[i], size: 6});
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
					details: JSON.stringify(out)
			});
		});
	}
}
