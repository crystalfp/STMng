/**
 * Render graphical output for Draw Structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-01
 */
import {Group, type Mesh, type MeshStandardMaterial, IcosahedronGeometry, CylinderGeometry,
		LineDashedMaterial, LineBasicMaterial, Vector3, BufferGeometry, Line, Color,
		Float32BufferAttribute, LineSegments, FrontSide} from "three";
import {sm} from "@/services/SceneManager";
import {getBoundingBox} from "@/services/BoundingBox";
import {spriteText, disposeTextInGroup, BillboardBatchedText} from "@/services/SpriteText";
import {SpheresCache} from "@/services/SpheresCache";
import {CylinderCache} from "@/services/CylinderCache";
import {useControlStore} from "@/stores/controlStore";
import type {PositionType, StructureRenderInfo} from "@/types";

// > Constants
const bondRadius = 0.1;
const sphereSubdivisions   = [0, 0, 1,  3,  9];
const cylinderSubdivisions = [0, 3, 5, 10, 16];
const rCovScale = 0.5;

/**
 * Renderer for draw structure graphical output
 */
export class DrawStructureRenderer {

	private readonly atomsGroup = new Group();
	private readonly bondsGroup = new Group();
	private readonly labelsGroup = new Group();
	private readonly out = new Group();
	private readonly outName;
	private drawQuality: number;
	private drawRoughness: number;
	private drawMetalness: number;

	constructor(id: string, drawQuality: number,
				drawRoughness: number, drawMetalness: number) {

		this.drawQuality   = drawQuality;
		this.drawRoughness = drawRoughness;
		this.drawMetalness = drawMetalness;

		// Name the groups (useful for debugging)
		this.atomsGroup.name  = "Atoms";
		this.bondsGroup.name  = "Bonds";
		this.labelsGroup.name = "Labels";
		this.outName = "DrawStructure-" + id;
		this.out.name = this.outName;

		// Add to the scene
		sm.clearAndAddGroup(this.out);

		// Combine and add the groups
		this.out.add(this.atomsGroup, this.bondsGroup, this.labelsGroup);
	}

	/**
	 * Adjust 3D objects characteristics
	 *
	 * @param drawQuality - Rendering quality (1-4)
	 * @param drawRoughness - Surface roughness (0-1)
	 * @param drawMetalness - Surface metalness (0-1)
	 */
	adjustMaterials(drawQuality: number, drawRoughness: number, drawMetalness: number): void {

		this.drawQuality = drawQuality;
		this.drawRoughness = drawRoughness;
		this.drawMetalness = drawMetalness;

		const detail = sphereSubdivisions[drawQuality];
		const segments = cylinderSubdivisions[drawQuality];
		this.out.traverse((object) => {
			if(object.type !== "Mesh") return;
			const mesh = object as Mesh;
			const material = mesh.material as MeshStandardMaterial;
			material.roughness = drawRoughness;
			material.metalness = drawMetalness;
			material.side = FrontSide;

			const {geometry} = mesh;
			if(geometry.type === "IcosahedronGeometry") {
				const sphere = geometry as IcosahedronGeometry;
				if(sphere.parameters.detail !== detail) {
					const {radius} = sphere.parameters;
					mesh.geometry = new IcosahedronGeometry(radius, detail);
				}
			}
			else if(geometry.type === "CylinderGeometry") {
				const cylinder = geometry as CylinderGeometry;
				if(cylinder.parameters.radialSegments !== segments) {
					const {radiusTop, radiusBottom, height} = cylinder.parameters;

					mesh.geometry = new CylinderGeometry(radiusTop, radiusBottom,
															   height, segments, 1, true);
				}
			}
		});
		sm.modified();
	}

	/**
	 * Create an hydrogen bond (dashed line)
	 *
	 * @param from - Position of the bond start
	 * @param to - Position of the bond end
	 * @param group - The output group where to add the bond
	 */
	private addHBond(from: PositionType, to: PositionType, group: Group): void {

		const material = new LineDashedMaterial({
								color: 0x777777,
								scale: 20,
								dashSize: 1,
								gapSize: 1,
							});

		const points = [
			new Vector3(from[0], from[1], from[2]),
			new Vector3(to[0], to[1], to[2]),
		];
		const geometry = new BufferGeometry().setFromPoints(points);
		const line = new Line(geometry, material);
		line.computeLineDistances();
		group.add(line);
		sm.modified();
	}

	/**
	 * Draw a line bond between two atoms of different type
	 *
	 * @param from - Position of the bond start
	 * @param to - Position of the bond end
	 * @param colorFrom - Color of the bond start
	 * @param colorTo - Color of the bond end
	 * @param group - The output group where to add the bond
	 */
	private addNormalBond(from: PositionType, to: PositionType,
						  colorFrom: string, colorTo: string, group: Group): void {

		const midX = (from[0]+to[0])/2;
		const midY = (from[1]+to[1])/2;
		const midZ = (from[2]+to[2])/2;

		const vertices = [
			from[0], from[1], from[2],
			midX, midY, midZ,
			midX, midY, midZ,
			to[0], to[1], to[2]
		];

		const c1 = new Color(colorFrom);
		const c2 = new Color(colorTo);
		const colors = [
			c1.r, c1.g, c1.b,
			c1.r, c1.g, c1.b,
			c2.r, c2.g, c2.b,
			c2.r, c2.g, c2.b,
		];

		const geometry = new BufferGeometry();
		geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
		geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

		const material = new LineBasicMaterial({vertexColors: true});

		group.add(new LineSegments(geometry, material));
		sm.modified();
	}

	/**
	 * Draw a line bond between two atoms of same type
	 *
	 * @param from - Position of the bond start
	 * @param to - Position of the bond end
	 * @param color - Common color of the bonded atoms
	 * @param group - The output group where to add the bond
	 */
	private addNormalBondSameAtoms(from: PositionType, to: PositionType,
								   color: string, group: Group): void {

		const start = new Vector3(from[0], from[1], from[2]);
		const end   = new Vector3(to[0], to[1], to[2]);

		const material = new LineBasicMaterial({color});
		const geometry = new BufferGeometry().setFromPoints([start, end]);
		group.add(new Line(geometry, material));
		sm.modified();
	}

	/**
	 * Adjust start and end positions of the bond rendered as cylinder to have a better coloring
	 *
	 * @param start - Center of the first atom
	 * @param end - Center of the second atom
	 * @param radiusStart - Radius of the rendered first atom
	 * @param radiusEnd - Radius of the rendered second atom
	 * @returns Adjusted start and end positions for the bond rendered as cylinder
	 */
	private adjustLimitsCylinder(start: PositionType,
								 end: PositionType,
								 radiusStart: number,
								 radiusEnd: number): {start: PositionType; end: PositionType} {

		// No adjustment for low quality structure rendering
		if(this.drawQuality < 2) return {start, end};

		const dx = end[0] - start[0];
		const dy = end[1] - start[1];
		const dz = end[2] - start[2];
		const len = Math.hypot(dx, dy, dz);
		const nx = dx/len;
		const ny = dy/len;
		const nz = dz/len;

		// Distance from the center to have the cylinder border on the atom surface
		// const b = Math.sqrt((rCov/2)**2 - 0.1**2)
		// 0.035 = max(rCov/2-b) over all atom types
		const adjustRadiusStart = radiusStart-0.035;
		const adjustRadiusEnd = radiusEnd-0.035;

		const adjustedStart: PositionType = [
			nx*adjustRadiusStart + start[0],
			ny*adjustRadiusStart + start[1],
			nz*adjustRadiusStart + start[2]
		];

		const adjustedEnd: PositionType = [
			end[0] - nx*adjustRadiusEnd,
			end[1] - ny*adjustRadiusEnd,
			end[2] - nz*adjustRadiusEnd
		];

		return {start: adjustedStart, end: adjustedEnd};
	}

	/**
	 * Convert the structure data into 3D objects
	 *
	 * @param renderInfo - The structure to be rendered
	 * @param drawKind - Structure rendering style
	 * @param shadedBonds - If the bonds color should be shaded or as two color bands
	 */
	drawStructure(renderInfo: StructureRenderInfo, drawKind: string,
				  shadedBonds: boolean, showBondsStrength: boolean): void {

		// Clear previous structure
		sm.clearGroup(this.outName);
		this.atomsGroup.clear();
		this.bondsGroup.clear();
		this.labelsGroup.clear();
		this.out.add(this.atomsGroup, this.bondsGroup, this.labelsGroup);
		sm.modified();

		// No atoms present, display nothing
		if(renderInfo.atoms.length === 0) return;

		// Render atoms if present
		if(drawKind !== "lines") {

			const spheresCache = new SpheresCache(sphereSubdivisions[this.drawQuality],
												  this.drawRoughness,
												  this.drawMetalness);

			// Render atoms
			for(const atom of renderInfo.atoms) {

				const {position} = atom;
				let radius;
				switch(drawKind) {
					case "ball-and-stick":
						radius = atom.rCov*rCovScale;
						break;
					case "van-der-waals":
						radius = atom.rVdW;
						break;
					case "licorice":
						radius = bondRadius;
						break;
					default:
						radius = 1;
						break;
				}
				spheresCache.addSphere(position, radius, atom.color);
			}
			spheresCache.renderSpheres(this.atomsGroup);
			sm.modified();

			const controlStore = useControlStore();
			controlStore.addSelectionMapping(spheresCache.returnAtomsMap());
		}

		// Render bonds
		switch(drawKind) {
			case "ball-and-stick": {
				const cylinderCache = new CylinderCache(bondRadius, shadedBonds,
														cylinderSubdivisions[this.drawQuality],
														this.drawRoughness, this.drawMetalness);
				for(const bond of renderInfo.bonds) {

					const atomFrom = renderInfo.atoms[bond.from];
					const atomTo   = renderInfo.atoms[bond.to];
					if(bond.type === 1) this.addHBond(atomFrom.position, atomTo.position, this.bondsGroup);
					else if(showBondsStrength) {

						const strengthFrom = renderInfo.atoms[bond.from].bondStrength;
						const strengthTo   = renderInfo.atoms[bond.to].bondStrength;
						const strength     = Math.sqrt(strengthFrom*strengthTo)*4;

						cylinderCache.addCylinder(atomFrom.position, atomTo.position,
												  atomFrom.color, atomTo.color, strength);
					}
					else {
						const radiusStart  = atomFrom.rCov*rCovScale;
						const radiusEnd    = atomTo.rCov*rCovScale;
						const {start, end} = this.adjustLimitsCylinder(atomFrom.position, atomTo.position,
																	   radiusStart, radiusEnd);
						cylinderCache.addCylinder(start, end, atomFrom.color, atomTo.color);
					}
				}
				cylinderCache.renderCylinders(this.bondsGroup);
				sm.modified();
				break;
			}
			case "licorice": {
				const cylinderCache = new CylinderCache(bondRadius, shadedBonds, this.drawQuality,
					this.drawRoughness, this.drawMetalness);
				for(const bond of renderInfo.bonds) {

					const atomFrom = renderInfo.atoms[bond.from];
					const atomTo   = renderInfo.atoms[bond.to];
					if(bond.type === 1) this.addHBond(atomFrom.position, atomTo.position, this.bondsGroup);
					else {
						cylinderCache.addCylinder(atomFrom.position, atomTo.position,
												  atomFrom.color, atomTo.color);
					}
				}
				cylinderCache.renderCylinders(this.bondsGroup);
				sm.modified();
				break;
			}
			case "lines":
				for(const bond of renderInfo.bonds) {

					const atomFrom = renderInfo.atoms[bond.from];
					const atomTo   = renderInfo.atoms[bond.to];
					if(bond.type === 1) this.addHBond(atomFrom.position, atomTo.position, this.bondsGroup);
					else if(atomFrom.atomZ === atomTo.atomZ) {
						const {color, position} = atomFrom;
						this.addNormalBondSameAtoms(position, atomTo.position, color, this.bondsGroup);
					}
					else {
						const colorFrom = atomFrom.color;
						const colorTo   = atomTo.color;
						this.addNormalBond(atomFrom.position, atomTo.position, colorFrom, colorTo, this.bondsGroup);
					}
				}
				break;
			case "van-der-waals":
				// Do nothing
				break;
		}

		// Find the camera rotation center and position based
		// on the structure bounding box
		sm.setBoundingBox(getBoundingBox(renderInfo));
	}

	/**
	 * Draw the atoms labels
	 *
	 * @param renderInfo - The structure to be rendered
	 * @param showLabels - Make labels visible
	 * @param drawKind - Structure draw style
	 * @param labelKind - Label to be rendered
	 * @throws Error.
	 * "Impossible draw kind value"
	 */
	drawLabels(renderInfo: StructureRenderInfo, showLabels: boolean,
			   drawKind: string, labelKind: string): void {

		// Remove existing labels
		disposeTextInGroup(this.labelsGroup);
		sm.modified();

		const {atoms} = renderInfo;

		// No atoms present or no label requested, display nothing
		if(!atoms || atoms.length === 0 || !showLabels) return;

		// Render labels
		const billboardLabels = new BillboardBatchedText();
		const color = "#FFFFFF";
		let idx = 0;
		for(const atom of atoms) {

			let offset = 0;
			switch(drawKind) {
				case "ball-and-stick":
					offset = atom.rCov * rCovScale * 1.3;
					break;
				case "van-der-waals":
					offset = atom.rVdW * 1.3;
					break;
				case "licorice":
					offset = bondRadius * 2.5;
					break;
				case "lines":
					offset = 0.1;
					break;
				default: throw Error(`Impossible draw kind value "${drawKind}"`);
			}

			let labelText;
			switch(labelKind) {
				case "symbol":
					labelText = atom.symbol;
					break;
				case "label":
					labelText = atom.label;
					break;
				case "index":
					labelText = idx.toString();
					break;
				default:
					labelText = "?";
					break;
			}

			const {position} = atom;
			const labelPosition: PositionType = [position[0], position[1], position[2]+offset];
			const atomLabel = spriteText(labelText, color, 0.4, labelPosition);

			billboardLabels.add(atomLabel);

			++idx;
		}
		billboardLabels.sync();
		billboardLabels.name = "AtomLabels";
		this.labelsGroup.add(billboardLabels);
		sm.modified();
	}

	/**
	 * Set visibility of various part of the structure
	 *
	 * @param showAtoms - Atoms visibility
	 * @param showBonds - Bonds visibility
	 * @param showLabels - Labels visibility
	 */
	setVisibility(showAtoms: boolean, showBonds: boolean, showLabels: boolean): void {

    	this.labelsGroup.visible = showLabels;
    	this.bondsGroup.visible  = showBonds;
    	this.atomsGroup.visible  = showAtoms;
    	sm.modified();
	}
}
