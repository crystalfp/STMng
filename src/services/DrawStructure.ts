import {sb, type UiParams} from "@/services/Switchboard";
import type {StructureReaderData} from "./StructureReader";
import * as THREE from "three";
import type {PositionType} from "@/types";
// import log from "electron-log";
import {normalMaterial, lineDashedMaterial, colorTextureMaterial} from "./HelperMaterials";


export class DrawStructure {

	private drawQuality = 4;
	private drawKind = "ball-and-stick";
	private drawRoughness = 0.7;
	private drawMetalness = 0.3;
	private readonly out = new THREE.Group();
	private readonly bondRadius = 0.1;
	private readonly sphereSubdivisions = [0, 2, 4, 6, 10];
	private readonly cylinderSubdivisions = [0, 4, 8, 16, 32];
	private readonly rCovScale = 0.5;

	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {

    		this.drawKind = params.drawKind as string ?? "ball-and-stick";
    		this.drawQuality = params.drawQuality as number ?? 4;
    		this.drawRoughness = params.drawRoughness as number ?? 0.7;
    		this.drawMetalness = params.drawMetalness as number ?? 0.3;

			this.adjustMaterials();
		});

		sb.getData(this.id, (data: unknown) => {
			this.drawStructure(data as StructureReaderData, this.drawKind);
		});
		sb.setData(this.id, this.out);
	}

	private drawStructure(data: StructureReaderData, kind: string): void {

		// Clear previous structure
		this.out.traverse((object) => {
			if(object.type !== "Mesh") return;
			const mesh = object as THREE.Mesh;
			if(mesh.geometry) mesh.geometry.dispose();
			if(mesh.material) (mesh.material as THREE.Material).dispose();
			if(mesh.material) {
				if(Array.isArray(mesh.material)) {
					for(const material of mesh.material) (material as THREE.Material).dispose();
				}
				else {
					(mesh.material as THREE.Material).dispose();
				}
			}
			// The parent might be the scene or another Object3D, but it is sure to be removed this way
			object.removeFromParent();
		});

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
		// console.log(`Receive "${kind}" quality ${quality}`); // TBD
		// console.log(JSON.stringify(data, undefined, 2));
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


		const material = lineDashedMaterial(0x888888);
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
		const mid = start.lerp(end, 0.5);

		const material1 = new THREE.LineBasicMaterial({color: colorFrom});
		const geometry1 = new THREE.BufferGeometry().setFromPoints([start, mid]);
		this.out.add(new THREE.Line(geometry1, material1));

		const material2 = new THREE.LineBasicMaterial({color: colorTo});
		const geometry2 = new THREE.BufferGeometry().setFromPoints([mid, end]);
		this.out.add(new THREE.Line(geometry2, material2));
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
