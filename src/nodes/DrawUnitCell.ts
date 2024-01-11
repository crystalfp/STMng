/**
 * Display the structure unit cell.
 *
 * @packageDocumentation
 */
import * as THREE from "three";
import {sb, type UiParams} from "@/services/Switchboard";
import type {BasisType, PositionType, Structure} from "@/types";

export class DrawUnitCell {

	private readonly name: string;
	private showUnitCell = true;
	private dashedLine = false;
	private lineColor = "#0000FF";
	private readonly out = new THREE.Group();
	private line: THREE.LineSegments | undefined;

	constructor(private readonly id: string) {

		this.name = `DrawUnitCell-${this.id}`;
		this.out.name = this.name;
		sb.sceneAddGroup(this.out);

		sb.getUiParams(this.id, (params: UiParams) => {

    		this.showUnitCell = params.showUnitCell as boolean ?? true;
			this.lineColor = params.lineColor as string ?? "#0000FF";
			this.dashedLine = params.dashedLine as boolean ?? false;

			this.changeMaterial();
			this.out.visible = this.showUnitCell;
		});

		sb.getData(this.id, (data: unknown) => {

			const {crystal} = (data as Structure);
			if(!crystal) return;
			this.drawUnitCell(crystal.basis, crystal.origin);
		});
	}

	private drawUnitCell(basis: BasisType, orig: PositionType): void {

		// Clear previous cell
		sb.sceneClearGroup(this.name);

		// If no unit cell return
		if(!basis.some((value) => value !== 0)) return;

		// Vertices coordinates (bottom then top)
    	const vertices = new Float32Array([
/* 0 */ orig[0],                            orig[1],                            orig[2],
/* 1 */ orig[0]+basis[0],                   orig[1]+basis[1],                   orig[2]+basis[2],
/* 2 */ orig[0]+basis[0]+basis[3],          orig[1]+basis[1]+basis[4],          orig[2]+basis[2]+basis[5],
/* 3 */ orig[0]+basis[3],                   orig[1]+basis[4],                   orig[2]+basis[5],
/* 4 */ orig[0]+basis[6],                   orig[1]+basis[7],                   orig[2]+basis[8],
/* 5 */ orig[0]+basis[0]+basis[6],          orig[1]+basis[1]+basis[7],          orig[2]+basis[2]+basis[8],
/* 6 */ orig[0]+basis[0]+basis[3]+basis[6], orig[1]+basis[1]+basis[4]+basis[7], orig[2]+basis[2]+basis[5]+basis[8],
/* 7 */ orig[0]+basis[3]+basis[6],          orig[1]+basis[4]+basis[7],          orig[2]+basis[5]+basis[8],
    	]);

		// Triangles. Top and bottom facies are not needed
		const indices = [
			// 0, 1, 2,
			// 0, 2, 3,

			4, 5, 1,
			4, 1, 0,

			3, 2, 6,
			3, 6, 7,

			4, 0, 3,
			4, 3, 7,

			1, 5, 6,
			1, 6, 2,

			// 5, 4, 7,
			// 5, 7, 6,
		];

	    const geometry = new THREE.BufferGeometry();
		geometry.setIndex(indices);
		geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
		const edges = new THREE.EdgesGeometry(geometry);

        this.line = new THREE.LineSegments(edges, this.setMaterial());
        if(this.dashedLine) this.line.computeLineDistances();
        this.out.add(this.line);
	}

	private setMaterial(): THREE.Material {
		return this.dashedLine ?
							new THREE.LineDashedMaterial({
								color: this.lineColor,
								scale: 5,
								dashSize: 1,
								gapSize: 1,
							}) :
							new THREE.LineBasicMaterial({
								color: this.lineColor
							});
	}

	private changeMaterial(): void {
		if(this.line) {
			this.line.material = this.setMaterial();
        	if(this.dashedLine) this.line.computeLineDistances();
		}
	}

	saveStatus(): string {

		const statusToSave = {
			showUnitCell: this.showUnitCell,
			dashedLine: this.dashedLine,
			lineColor: this.lineColor,
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
