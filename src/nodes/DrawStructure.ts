/**
 * Transform the chemical structure in a set of 3D objects in the scene.
 *
 * @packageDocumentation
 */
import * as THREE from "three";
import {sb, type UiParams} from "@/services/Switchboard";
import {normalMaterial, colorTextureMaterial} from "@/services/HelperMaterials";
import SpriteText from "three-spritetext";
import type {PositionType, Structure} from "@/types";
import {sm} from "@/services/SceneManager";

export class DrawStructure {

	private drawQuality = 4;
	private drawKind = "ball-and-stick";
	private previousDrawKind = "ball-and-stick";
	private drawRoughness = 0.5;
	private drawMetalness = 0.6;
	private labelKind = "symbol";
	private showStructure = true;
	private showBonds = true;
	private showLabels = true;
	private readonly out = new THREE.Group();
	private readonly atomsGroup = new THREE.Group();
	private readonly bondsGroup = new THREE.Group();
	private readonly labelsGroup = new THREE.Group();
	private readonly bondRadius = 0.1;
	private readonly sphereSubdivisions = [0, 2, 4, 6, 10];
	private readonly cylinderSubdivisions = [0, 4, 8, 16, 32];
	private readonly rCovScale = 0.5;
	private loadedData: Structure = {crystal: {basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
											   origin: [0, 0, 0], spaceGroup: ""},
											   atoms: [], bonds: [], look: {}};

	/**
	 * Create the node
	 *
	 * @param id - ID of the Draw Structure node
	 */
	constructor(private readonly id: string) {

		// Get UI parameters
		sb.getUiParams(this.id, (params: UiParams) => {

    		this.drawKind = params.drawKind as string ?? "ball-and-stick";
    		this.drawQuality = params.drawQuality as number ?? 4;
    		this.drawRoughness = params.drawRoughness as number ?? 0.5;
    		this.drawMetalness = params.drawMetalness as number ?? 0.6;
    		this.labelKind = params.labelKind as string ?? "symbol";
    		this.showStructure = params.showStructure as boolean ?? true;
    		this.showBonds = params.showBonds as boolean ?? true;
    		this.showLabels = params.showLabels as boolean ?? true;

			// Combine the groups
			this.out.add(this.atomsGroup, this.bondsGroup, this.labelsGroup);

			// Adjust the geometry appearance
			this.adjustMaterials();

			// Redraw the structure if the representation changes
			if(this.drawKind !== this.previousDrawKind) {
				this.drawStructure(this.loadedData);
				this.previousDrawKind = this.drawKind;
			}
			this.drawLabels(this.loadedData);

			// Structure parts visibility
			this.out.visible = this.showStructure;
			this.bondsGroup.visible = this.showBonds;
			this.labelsGroup.visible = this.showLabels;
		});

		// Get the input data
		sb.getData(this.id, (data: unknown) => {
			this.drawStructure(data as Structure);
			this.loadedData = data as Structure;
			this.drawLabels(this.loadedData);
		});

		this.out.name = `DrawStructure-${this.id}`;
		sm.add(this.out);
	}

	/**
	 * Convert the structure data into 3D objects
	 *
	 * @param data - Structure data
	 */
	private drawStructure(data: Structure): void {

		// Clear previous structure
		sm.clearGroup(`DrawStructure-${this.id}`);
		this.atomsGroup.clear();
		this.bondsGroup.clear();
		this.labelsGroup.clear();
		this.out.add(this.atomsGroup, this.bondsGroup, this.labelsGroup);

		// No atoms present, display nothing
		if(!data.atoms) return;

		// Render atoms
		switch(this.drawKind) {
			case "ball-and-stick":
				for(const atom of data.atoms) {
					const {color} = data.look[atom.atomZ];
					const radius = data.look[atom.atomZ].rCov * this.rCovScale;
					this.addSphere(radius, color, atom.position, this.atomsGroup);
				}
				break;
			case "van-der-walls":
				for(const atom of data.atoms) {
					const {color} = data.look[atom.atomZ];
					const radius = data.look[atom.atomZ].rVdW;
					this.addSphere(radius, color, atom.position, this.atomsGroup);
				}
				break;
			case "licorice":
				for(const atom of data.atoms) {
					const {color} = data.look[atom.atomZ];
					this.addSphere(this.bondRadius, color, atom.position, this.atomsGroup);
				}
				break;
		}

		// Render bonds
		switch(this.drawKind) {
			case "ball-and-stick":
			case "licorice":
				for(const bond of data.bonds) {

					const atomFrom = data.atoms[bond.from];
					const atomTo   = data.atoms[bond.to];
					if(bond.type === "h") this.addHBond(atomFrom.position, atomTo.position, this.bondsGroup);
					else {
						const colorFrom = data.look[atomFrom.atomZ].color;
						const colorTo   = data.look[atomTo.atomZ].color;
						this.addCylinder(atomFrom.position, atomTo.position,
										 this.bondRadius, colorFrom, colorTo, this.bondsGroup);
					}
				}
				break;
			case "lines":
				for(const bond of data.bonds) {
					const atomFrom  = data.atoms[bond.from];
					const atomTo    = data.atoms[bond.to];
					if(bond.type === "h") this.addHBond(atomFrom.position, atomTo.position, this.bondsGroup);
					else if(atomFrom.atomZ === atomTo.atomZ) {
						const {color} = data.look[atomFrom.atomZ];
						this.addNormalBondSameAtoms(atomFrom.position, atomTo.position, color, this.bondsGroup);
					}
					else {
						const colorFrom = data.look[atomFrom.atomZ].color;
						const colorTo   = data.look[atomTo.atomZ].color;
						this.addNormalBond(atomFrom.position, atomTo.position, colorFrom, colorTo, this.bondsGroup);
					}
				}
				break;
		}

		// Find the camera rotation center
		const center: [number, number, number] = [0, 0, 0];
		const natoms = data.atoms.length;
		for(const atom of data.atoms) {
			center[0] += atom.position[0];
			center[1] += atom.position[1];
			center[2] += atom.position[2];
		}
		center[0] /= natoms;
		center[1] /= natoms;
		center[2] /= natoms;

		sm.setCenter(center);
	}

	/**
	 * Draw the atoms labels
	 *
	 * @param data - The structure data
	 */
	drawLabels(data: Structure): void {

		// Remove existing labels
		const labelsToDelete: THREE.Sprite[] = [];
		this.labelsGroup.traverse((obj) => {

			if(obj.type === "Sprite") labelsToDelete.push(obj as THREE.Sprite);
		});
		for(const obj of labelsToDelete) {
			this.labelsGroup.remove(obj);
			obj.material.dispose();
		}

		// No atoms present or no label requested, display nothing
		if(!data?.atoms || data.atoms.length === 0 || !this.showLabels) return;

		// Render labels
		const color = "#FFFFFF";
		let idx = 0;
		for(const atom of data.atoms) {

			let offset = 0;
			switch(this.drawKind) {
				case "ball-and-stick":
					offset = data.look[atom.atomZ].rCov * this.rCovScale * 1.3;
					break;
				case "van-der-walls":
					offset = data.look[atom.atomZ].rVdW * 1.3;
					break;
				case "licorice":
					offset = this.bondRadius * 2.5;
					break;
				case "lines":
					offset = 0.1;
					break;
			}

			let labelText;
			switch(this.labelKind) {
				case "symbol":
					labelText = data.look[atom.atomZ].symbol;
					break;
				case "label":
					labelText = atom.label;
					break;
				case "index":
					labelText = idx.toString();
					break;
			}

			const label = new SpriteText(labelText, 0.3, color);
			label.fontSize = 160;
			const pos = atom.position;
			label.position.set(pos[0], pos[1], pos[2] + offset);
			this.labelsGroup.add(label);

			++idx;
		}
	}

	/**
	 * Adjust 3D objects characteristics
	 */
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

	/**
	 * Draw a sphere
	 *
	 * @param radius - Sphere radius
	 * @param color - Sphere color
	 * @param position - Center of the sphere
	 * @param out - The output group where to add the sphere
	 */
	private addSphere(radius: number,
					  color: THREE.ColorRepresentation,
					  position: PositionType,
					  out: THREE.Group): void {

		const subdivisions = this.sphereSubdivisions[this.drawQuality];
		const geometry = new THREE.IcosahedronGeometry(radius, subdivisions);
		const meshMaterial = normalMaterial(color, this.drawRoughness, this.drawMetalness);
		const sphere = new THREE.Mesh(geometry, meshMaterial);
		sphere.position.set(position[0], position[1], position[2]);
		out.add(sphere);
	}

	/**
	 * Create an hydrogen bond (dashed line)
	 *
	 * @param from - Position of the bond start
	 * @param to - Position of the bond end
	 * @param out - The output group where to add the bond
	 */
	private addHBond(from: PositionType, to: PositionType, out: THREE.Group): void {

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
		out.add(line);
	}

	/**
	 * Draw a line bond between two atoms of different type
	 *
	 * @param from - Position of the bond start
	 * @param to - Position of the bond end
	 * @param colorFrom - Color of the bond start
	 * @param colorTo - Color of the bond end
	 * @param out - The output group where to add the bond
	 */
	private addNormalBond(from: PositionType, to: PositionType,
					      colorFrom: string, colorTo: string, out: THREE.Group): void {

		const midX = (from[0]+to[0])/2;
		const midY = (from[1]+to[1])/2;
		const midZ = (from[2]+to[2])/2;

		const vertices = [
			from[0], from[1], from[2],
			midX, midY, midZ,
			midX, midY, midZ,
			to[0], to[1], to[2]
		];

		const c1 = new THREE.Color(colorFrom);
		const c2 = new THREE.Color(colorTo);
		const colors = [
			c1.r, c1.g, c1.b,
			c1.r, c1.g, c1.b,
			c2.r, c2.g, c2.b,
			c2.r, c2.g, c2.b,
		];

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
		geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

		const material = new THREE.LineBasicMaterial({vertexColors: true});

		out.add(new THREE.LineSegments(geometry, material));
	}

	/**
	 * Draw a line bond between two atoms of same type
	 *
	 * @param from - Position of the bond start
	 * @param to - Position of the bond end
	 * @param color - Common color of the bonded atoms
	 * @param out - The output group where to add the bond
	 */
	private addNormalBondSameAtoms(from: PositionType, to: PositionType, color: string, out: THREE.Group): void {

		const start = new THREE.Vector3(from[0], from[1], from[2]);
		const end   = new THREE.Vector3(to[0], to[1], to[2]);

		const material = new THREE.LineBasicMaterial({color});
		const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
		out.add(new THREE.Line(geometry, material));
	}

	/**
	 * Create a quaternion from a direction vector (versor)
	 *
	 * @param nx - Versor x component
	 * @param ny - Versor y component
	 * @param nz - Versor z component
	 * @returns The computed quaternion
	 */
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

	/**
	 * Create a cylinder bond
	 *
	 * @remarks Till now it is not shaded with a color gradient
	 * @param from - Position of the bond start
	 * @param to - Position of the bond end
	 * @param radius - Radius of the bond
	 * @param colorStart - Color of the bond start
	 * @param colorEnd - Color of the bond end
	 * @param out - The output group where to add the bond
	 */
	private addCylinder(start: PositionType, end: PositionType,
							   radius: number, colorStart: THREE.ColorRepresentation,
							   colorEnd: THREE.ColorRepresentation, out: THREE.Group): void {

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
		out.add(cylinder);
	}

	/**
	 * Save the node status
	 *
	 * @returns The JSON formatted status to be saved
	 */
	saveStatus(): string {

		const statusToSave = {
			drawKind: this.drawKind,
			drawQuality: this.drawQuality,
			drawRoughness: this.drawRoughness,
			drawMetalness: this.drawMetalness,
			labelKind: this.labelKind,
			showStructure: this.showStructure,
			showBonds: this.showBonds,
			showLabels: this.showLabels,
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
