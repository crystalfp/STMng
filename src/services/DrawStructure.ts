import {sb, type UiParams} from "@/services/Switchboard";
import type {StructureReaderData} from "@/services/StructureReader";
import * as THREE from "three";
import type {PositionType} from "@/types";
// import log from "electron-log";
import {normalMaterial, colorTextureMaterial} from "@/services/HelperMaterials";
import SpriteText from "three-spritetext";


export class DrawStructure {

	private drawQuality = 4;
	private drawKind = "ball-and-stick";
	private previousDrawKind = "ball-and-stick";
	private drawRoughness = 0.7;
	private drawMetalness = 0.3;
	private showLabels = true;
	private readonly out = new THREE.Group();
	private readonly bondRadius = 0.1;
	private readonly sphereSubdivisions = [0, 2, 4, 6, 10];
	private readonly cylinderSubdivisions = [0, 4, 8, 16, 32];
	private readonly rCovScale = 0.5;
	private loadedData: StructureReaderData = {crystal: {basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
														 origin: [0, 0, 0], spaceGroup: ""},
														 atoms: [], bonds: [], look: {}};

	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {

    		this.drawKind = params.drawKind as string ?? "ball-and-stick";
    		this.drawQuality = params.drawQuality as number ?? 4;
    		this.drawRoughness = params.drawRoughness as number ?? 0.7;
    		this.drawMetalness = params.drawMetalness as number ?? 0.3;
    		this.showLabels = params.showLabels as boolean ?? true;

			this.adjustMaterials();

			if(this.drawKind !== this.previousDrawKind) {
				this.drawStructure(this.loadedData, this.drawKind);
				this.previousDrawKind = this.drawKind;
			}

			sb.accessScene().traverse((obj) => {

				if(obj.name === "AtomLabel") {
					(obj as THREE.Sprite).material.visible = this.showLabels;
				}
			});
		});

		sb.getData(this.id, (data: unknown) => {
			this.drawStructure(data as StructureReaderData, this.drawKind);
			this.loadedData = data as StructureReaderData;
			this.drawLabels(this.loadedData, this.drawKind);
		});

		this.out.name = `DrawStructure-${this.id}`;
		sb.sceneAddGroup(this.out);
	}

	private drawStructure(data: StructureReaderData, kind: string): void {

		// Clear previous structure
		sb.sceneClearGroup(`DrawStructure-${this.id}`);

		// No atoms present, display nothing
		if(!data.atoms) return;

		// Render atoms
		switch(kind) {
			case "ball-and-stick":
				for(const atom of data.atoms) {
					const {color} = data.look[atom.atomZ];
					const radius = data.look[atom.atomZ].rCov * this.rCovScale;
					this.addSphere(radius, color, atom.position);
				}
				break;
			case "van-der-walls":
				for(const atom of data.atoms) {
					const {color} = data.look[atom.atomZ];
					const radius = data.look[atom.atomZ].rVdW;
					this.addSphere(radius, color, atom.position);
				}
				break;
			case "licorice":
				for(const atom of data.atoms) {
					const {color} = data.look[atom.atomZ];
					this.addSphere(this.bondRadius, color, atom.position);
				}
				break;
		}

		// Render bonds
		switch(kind) {
			case "ball-and-stick":
			case "licorice":
				for(const bond of data.bonds) {

					const atomFrom = data.atoms[bond.from];
					const atomTo   = data.atoms[bond.to];
					if(bond.type === "h") this.addHBond(atomFrom.position, atomTo.position);
					else {
						const colorFrom = data.look[atomFrom.atomZ].color;
						const colorTo   = data.look[atomTo.atomZ].color;
						this.addCylinder(atomFrom.position, atomTo.position, this.bondRadius, colorFrom, colorTo);
					}
				}
				break;
			case "lines":
				for(const bond of data.bonds) {
					const atomFrom  = data.atoms[bond.from];
					const atomTo    = data.atoms[bond.to];
					if(bond.type === "h") this.addHBond(atomFrom.position, atomTo.position);
					else if(atomFrom.atomZ === atomTo.atomZ) {
						const {color} = data.look[atomFrom.atomZ];
						this.addNormalBondSameAtoms(atomFrom.position, atomTo.position, color);
					}
					else {
						const colorFrom = data.look[atomFrom.atomZ].color;
						const colorTo   = data.look[atomTo.atomZ].color;
						this.addNormalBond(atomFrom.position, atomTo.position, colorFrom, colorTo);
					}
				}
				break;
		}
	}

	drawLabels(data: StructureReaderData, kind: string): void {

		// Remove existing labels
		sb.accessScene().traverse((obj) => {

			if(obj.name === "AtomLabel") {
				this.out.remove(obj);
				(obj as THREE.Sprite).material.dispose();
			}
		});

		// No atoms present, display nothing
		if(!data?.atoms) return;

		// Render labels
		const color = "#FFFFFF";
		for(const atom of data.atoms) {

			// const {color} = data.look[atom.atomZ];
			let offset = 0;
			switch(kind) {
				case "ball-and-stick":
					offset = data.look[atom.atomZ].rCov * this.rCovScale * 1.3;
					break;
				case "van-der-walls":
					offset = data.look[atom.atomZ].rVdW * 1.3;
					break;
				case "licorice":
					offset = this.bondRadius * 1.3;
					break;
				case "lines":
					offset = 0.1;
					break;
			}

			const label = new SpriteText(atom.label, 0.3, color);
			label.fontSize = 160;
			const pos = atom.position;
			label.position.set(pos[0], pos[1], pos[2] + offset);
			label.name = "AtomLabel";
			this.out.add(label);
		}
	}

	private adjustMaterials(): void {

		const detail = this.sphereSubdivisions[this.drawQuality];
		const segments = this.cylinderSubdivisions[this.drawQuality];
		this.out.traverse((object) => {
			if(object.type !== "Mesh") return;
			const mesh = object as THREE.Mesh;
			const material = mesh.material as THREE.MeshStandardMaterial;
			material.roughness = this.drawRoughness;
			material.metalness = this.drawMetalness;

			const {geometry} = mesh;
			if(geometry.type === "IcosahedronGeometry") {
				const sphere = geometry as THREE.IcosahedronGeometry;
				if(sphere.parameters.detail !== detail) {
					const {radius} = sphere.parameters;
					mesh.geometry = new THREE.IcosahedronGeometry(radius, detail);
				}
			}
			else if(geometry.type === "CylinderGeometry") {
				const cylinder = geometry as THREE.CylinderGeometry;
				if(cylinder.parameters.radialSegments !== segments) {
					const {radiusTop, radiusBottom, height} = cylinder.parameters;

					mesh.geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom,
															   height, segments, 1, true);
				}
			}
		});
	}

	private addSphere(radius: number,
					  color: THREE.ColorRepresentation,
					  position: PositionType): void {

		const subdivisions = this.sphereSubdivisions[this.drawQuality];
		const geometry = new THREE.IcosahedronGeometry(radius, subdivisions);
		const meshMaterial = normalMaterial(color, this.drawRoughness, this.drawMetalness);
		const sphere = new THREE.Mesh(geometry, meshMaterial);
		sphere.position.set(position[0], position[1], position[2]);
		this.out.add(sphere);
	}

	private addHBond(from: PositionType, to: PositionType): void {

		const material = new THREE.LineDashedMaterial({
								color: 0x777777,
								scale: 20,
								dashSize: 1,
								gapSize: 1,
							});

		const points = [
			new THREE.Vector3(from[0], from[1], from[2]),
			new THREE.Vector3(to[0], to[1], to[2]),
		];
		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		const line = new THREE.Line(geometry, material);
		line.computeLineDistances();
		this.out.add(line);
	}

	private addNormalBond(from: PositionType, to: PositionType,
					      colorFrom: string, colorTo: string): void {

		const start = new THREE.Vector3(from[0], from[1], from[2]);
		const end = new THREE.Vector3(to[0], to[1], to[2]);
		const mid = new THREE.Vector3((from[0]+to[0])/2, (from[1]+to[1])/2, (from[2]+to[2])/2);

		const material1 = new THREE.LineBasicMaterial({linewidth: 4, color: colorFrom});
		const geometry1 = new THREE.BufferGeometry().setFromPoints([start, mid]);

		const material2 = new THREE.LineBasicMaterial({linewidth: 4, color: colorTo});
		const geometry2 = new THREE.BufferGeometry().setFromPoints([mid, end]);

		this.out.add(new THREE.Line(geometry1, material1), new THREE.Line(geometry2, material2));
	}

	private addNormalBondSameAtoms(from: PositionType, to: PositionType, color: string): void {

		const start = new THREE.Vector3(from[0], from[1], from[2]);
		const end   = new THREE.Vector3(to[0], to[1], to[2]);

		const material = new THREE.LineBasicMaterial({color});
		const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
		this.out.add(new THREE.Line(geometry, material));
	}

	private vectorToQuaternion(nx: number, ny: number, nz: number): THREE.Quaternion {

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
	}

	private addCylinder(start: PositionType, end: PositionType,
							   radius: number, colorStart: THREE.ColorRepresentation,
							   colorEnd: THREE.ColorRepresentation): void {

		const subdivisions = this.cylinderSubdivisions[this.drawQuality];

		const dx = start[0] - end[0];
		const dy = start[1] - end[1];
		const dz = start[2] - end[2];
		const len = Math.hypot(dx, dy, dz);
		const geometry = new THREE.CylinderGeometry(radius, radius, len, subdivisions, 1, true);
		const meshMaterial = colorTextureMaterial(new THREE.Color(colorStart), new THREE.Color(colorEnd),
												  this.drawRoughness, this.drawMetalness, subdivisions);
		const cylinder = new THREE.Mesh(geometry, meshMaterial);

		const midx = (start[0] + end[0])/2;
		const midy = (start[1] + end[1])/2;
		const midz = (start[2] + end[2])/2;
		cylinder.position.set(midx, midy, midz);
		cylinder.applyQuaternion(this.vectorToQuaternion(dx/len, -dy/len, dz/len));
		this.out.add(cylinder);
	}
}
