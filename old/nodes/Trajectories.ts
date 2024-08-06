/**
 * Draw atom trajectories as lines or as position clouds.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import * as THREE from "three";
import {sb, type UiParams} from "@/services/Switchboard";
import {sm} from "../../new/services/SceneManager";
import type {Structure, PositionType, BasisType} from "../../new/types";
import {selectAtomsByKind, type SelectorType} from "@/services/SelectAtoms";
import {useControlStore} from "@/stores/controlStore";
import {watchEffect} from "vue";
import {atomColor} from "@/services/AtomInfo";
import {VolumeRenderShader} from "@/services/VolumeShader";

export class Trajectories {

	private showTrajectories = false;
	private labelKind: SelectorType = "symbol";
	private atomsSelector = "";
	private reset = false;
	private nextSteps = false;
	private maxDisplacement = 1;
	private maxDisplacementPrevious = 1;
	private readonly group = new THREE.Group();
	private readonly groupName;
	private readonly points: THREE.Vector3[][] = [];
	private showPositionClouds = false;
	private showPositionCloudsPrevious = false;
	private positionCloudsSide = 32; // It is 2**positionCloudsSideExp
	private positionCloudsSideExp = 5;
	private positionCloudsSideExpPrevious = 5;
	private positionCloudsGrow = 0.1;
	private positionCloudsGrowPrevious = 0.1;
	private positionCloud: Float32Array | undefined;
	private positionLimits: number[] = [];
	private readonly traceColor: string[] = [];
	private volumeMesh: THREE.Mesh | undefined;
	private readonly colormap = this.generateColormap(false);
	private maxCount = 0;

	/**
	 * Create the node
	 *
	 * @param id - ID of the Trajectories node
	 */
	constructor(private readonly id: string) {

		this.groupName = `Trajectories-${this.id}`;
		this.group.name = this.groupName;
		sm.add(this.group);

		const controlStore = useControlStore();

		sb.getUiParams(this.id, (params: UiParams) => {
			this.showTrajectories = params.showTrajectories as boolean ?? false;
			this.labelKind = params.labelKind as SelectorType ?? "symbol";
			this.atomsSelector = params.atomsSelector as string ?? "";
			this.reset = params.reset as boolean ?? false;
			this.maxDisplacement = params.maxDisplacement as number ?? 1;

			if(this.reset) {
				this.reset = false;
				sb.setUiParams(this.id, {
					reset: false
				});

				this.points.length = 0;
				this.traceColor.length = 0;
				sm.clearGroup(this.groupName);

				this.nextSteps = false;

				if(this.positionCloud) this.positionCloud.fill(0);
			}

			if(this.maxDisplacement !== this.maxDisplacementPrevious) {

				this.drawLines(this.traceColor.length);
				this.maxDisplacementPrevious = this.maxDisplacement;
			}

			this.group.visible = this.showTrajectories;

			this.showPositionClouds = params.showPositionClouds as boolean ?? false;
			this.positionCloudsSideExp = params.positionCloudsSideExp as number ?? 5;
			this.positionCloudsSide = 2**this.positionCloudsSideExp;
			this.positionCloudsGrow = params.positionCloudsGrow as number ?? 0.1;

			if(this.showPositionClouds !== this.showPositionCloudsPrevious) {

				if(this.showPositionClouds) {
					if(this.volumeMesh) {
						this.removePositionClouds();
					}
					this.setupPositionClouds();
				}
				else if(this.volumeMesh) this.removePositionClouds();

				this.showPositionCloudsPrevious = this.showPositionClouds;
			}

			if(this.positionCloudsSideExp !== this.positionCloudsSideExpPrevious) {

				if(this.volumeMesh) this.updateCloudVolume();

				this.positionCloudsSideExpPrevious = this.positionCloudsSideExp;
			}

			if(this.positionCloudsGrow !== this.positionCloudsGrowPrevious) {

				if(this.volumeMesh) this.updateCloudVolume();

				this.positionCloudsGrowPrevious = this.positionCloudsGrow;
			}
		});

		sb.getData(this.id, (data: unknown) => {

			const structure = data as Structure;
			if(!structure) return;
			const {atoms, crystal} = structure;
			const {origin, basis} = crystal;
			this.computeLimits(origin, basis);
			if(this.showPositionClouds) this.setupPositionClouds();

			if(!controlStore.trajectoriesRecording) return;

			const indices = selectAtomsByKind(structure, this.labelKind, this.atomsSelector);

			this.setTraceColor(structure, indices, this.traceColor);

			if(controlStore.trajectoriesRecording) {
				const len = indices.length;
				if(this.nextSteps) {
					// After the first step increase the points size if the number of atoms traced increases
					if(len > this.points.length) {
						const previousLength = this.points.length;
						this.points.length = len;
						for(let i=previousLength; i < len; ++i) this.points[i] = [];
					}
				}
				else {

					this.nextSteps = true;

					// First step, initialize set of coordinates
					this.points.length = len;
					for(let i=0; i < len; ++i) this.points[i] = [];

					if(this.showPositionClouds && this.positionCloud) this.positionCloud.fill(0);
				}
			}

			// Record coordinates
			let trajectoryIndex = 0;
			for(const idx of indices) {

				const {position} = atoms[idx];

				this.points[trajectoryIndex]
					.push(new THREE.Vector3(position[0], position[1], position[2]));
				++trajectoryIndex;
				if(this.showPositionClouds && this.positionCloud) {
					this.accumulatePosition(position[0], position[1], position[2]);
				}
			}

			// Create lines
			this.drawLines(indices.length);

			// Create volume
			if(this.showPositionClouds) this.drawPositionClouds();
		});

		watchEffect(() => {
			if(!controlStore.trajectoriesRecording) this.nextSteps = false;
		});

		// Show this module has been mounted
		controlStore.hasTrajectory = true;
	}

	private setupPositionClouds(): void {

		if(this.positionLimits.length === 0 || this.volumeMesh) return;

		// Create volume data
		this.createCloudVolume();
	}

	private removePositionClouds(): void {
		sm.deleteMesh("PositionCloudVolume");
		// sm.deleteMesh("PositionCloudBorders");
		this.volumeMesh = undefined;
	}

	/**
	 * Create a colormap
	 *
	 * @remarks Use lut {@link https://threejs.org/docs/#examples/en/math/Lut}
	 *			then .lut and convert list of colors into Uint8Array
	 *			or createCanvas() method
	 * @param bw - True for a Black&White colormap
	 * @returns The texture 256x1 with the colormap
	 */
	private generateColormap(bw: boolean): THREE.Texture {

		const width = 256;
		const height = 1;

		const data = new Uint8Array(4 * width);

		if(bw) {
			for(let i = 0; i < width; i ++) {
				const stride = i * 4;
				data[stride]   = i;
				data[stride+1] = i;
				data[stride+2] = i;
				data[stride+3] = 255;
			}
		}
		else {
			const startColor = new THREE.Color("red");
			const endColor   = new THREE.Color("green");
			const lerpIncr = 1/width;
			for(let i = 0; i < width; i ++) {
				const lerpColor = new THREE.Color(startColor);
				lerpColor.lerpHSL(endColor, i * lerpIncr);
				const stride = i * 4;
				data[stride]   = lerpColor.r*255;
				data[stride+1] = lerpColor.g*255;
				data[stride+2] = lerpColor.b*255;
				data[stride+3] = 255;
			}
		}

		// Used the buffer to create a DataTexture
		const texture = new THREE.DataTexture(data, width, height);
		texture.needsUpdate = true;

		// Specify the texture format to match the stored data.
		texture.format = THREE.RGBAFormat;
		texture.type = THREE.UnsignedByteType;
		texture.minFilter = THREE.LinearFilter; // Linear interpolation of colors.
		texture.magFilter = THREE.LinearFilter; // Linear interpolation of colors.
		texture.wrapS = THREE.ClampToEdgeWrapping;
		texture.wrapT = THREE.ClampToEdgeWrapping;

		return texture;
	}

	/**
	 * Compute the limits for the volume enclosing the unit cell
	 *
	 * @param orig - Unit cell origin
	 * @param basis - Unit cell basis
	 */
	private computeLimits(orig: PositionType, basis: BasisType): void {

		if(basis.every((value: number) => value === 0)) return;

		const vv: number[] = [
/* 0 */ orig[0],                            orig[1],                            orig[2],
/* 1 */ orig[0]+basis[0],                   orig[1]+basis[1],                   orig[2]+basis[2],
/* 2 */ orig[0]+basis[0]+basis[3],          orig[1]+basis[1]+basis[4],          orig[2]+basis[2]+basis[5],
/* 3 */ orig[0]+basis[3],                   orig[1]+basis[4],                   orig[2]+basis[5],
/* 4 */ orig[0]+basis[6],                   orig[1]+basis[7],                   orig[2]+basis[8],
/* 5 */ orig[0]+basis[0]+basis[6],          orig[1]+basis[1]+basis[7],          orig[2]+basis[2]+basis[8],
/* 6 */ orig[0]+basis[0]+basis[3]+basis[6], orig[1]+basis[1]+basis[4]+basis[7], orig[2]+basis[2]+basis[5]+basis[8],
/* 7 */ orig[0]+basis[3]+basis[6],          orig[1]+basis[4]+basis[7],          orig[2]+basis[5]+basis[8],
		];

		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let minZ = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		let maxZ = Number.NEGATIVE_INFINITY;
		for(let i=0; i < 8; ++i) {
			if(vv[3*i] > maxX)   maxX = vv[3*i];
			if(vv[3*i+1] > maxY) maxY = vv[3*i+1];
			if(vv[3*i+2] > maxZ) maxZ = vv[3*i+2];
			if(vv[3*i] < minX)   minX = vv[3*i];
			if(vv[3*i+1] < minY) minY = vv[3*i+1];
			if(vv[3*i+2] < minZ) minZ = vv[3*i+2];
		}

		const growHalf = this.positionCloudsGrow/2;
		const growPlus1 = 1+this.positionCloudsGrow;
		const sideX = maxX-minX;
		const sideY = maxY-minY;
		const sideZ = maxZ-minZ;

		this.positionLimits = [
			minX-sideX*growHalf,	// Volume origin
			minY-sideY*growHalf,
			minZ-sideZ*growHalf,
			sideX*growPlus1,		// Volume sides
			sideY*growPlus1,
			sideZ*growPlus1,
		];
	}

	/**
	 * Create the volume that will enclose the position clouds
	 */
	private createCloudVolume(): void {

		if(this.positionLimits.length === 0) return;

		this.positionCloud = new Float32Array(this.positionCloudsSide*
											  this.positionCloudsSide*
											  this.positionCloudsSide);
		this.positionCloud.fill(0);

		const sx = this.positionLimits[3];
		const sy = this.positionLimits[4];
		const sz = this.positionLimits[5];

		const geometry = new THREE.BoxGeometry(sx, sy, sz);
		const tx = sx/2 + this.positionLimits[0];
		const ty = sy/2 + this.positionLimits[1];
		const tz = sz/2 + this.positionLimits[2];
		geometry.translate(tx, ty, tz);

		// TBD Show the volume limits for debugging
		// const edges = new THREE.EdgesGeometry(geometry);
		// const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({color: "#00FF00"}));
		// line.name = "PositionCloudBorders";
		// sm.add(line);

		this.volumeMesh = new THREE.Mesh(geometry, this.createCloudsMaterial());
		this.volumeMesh.name = "PositionCloudVolume";
		sm.add(this.volumeMesh);
	}

	/**
	 * Update the position cloud volume regenerating the volume
	 */
	private updateCloudVolume(): void {

		this.removePositionClouds();
		this.createCloudVolume();
	}

	/**
	 * Record a new position in the position cloud volume
	 *
	 * @param x - Position X for the atom
	 * @param y - Position Y for the atom
	 * @param z - Position Z for the atom
	 */
	private accumulatePosition(x: number, y: number, z: number): void {

		const ix = Math.floor(this.positionCloudsSide*(x-this.positionLimits[0])/this.positionLimits[3]);
		const iy = Math.floor(this.positionCloudsSide*(y-this.positionLimits[1])/this.positionLimits[4]);
		const iz = Math.floor(this.positionCloudsSide*(z-this.positionLimits[2])/this.positionLimits[5]);

		const max = ++this.positionCloud![ix+this.positionCloudsSide*(iy+this.positionCloudsSide*iz)];
		if(max > this.maxCount) this.maxCount = max;
	}

	private createCloudsMaterial(): THREE.ShaderMaterial {

		// TBD Debug
		// this.positionCloud?.fill(0);
		// for(let i=0; i < this.positionCloudsSide; ++i) this.positionCloud![i] = 2;
		// for(let i=0; i < this.positionCloudsSide; ++i) this.positionCloud![i*this.positionCloudsSide] = 2;
		// for(let i=0; i < this.positionCloudsSide; ++i) this.positionCloud![i*this.positionCloudsSide
		//																	   *this.positionCloudsSide] = 2;

		const texture = new THREE.Data3DTexture(this.positionCloud,
												this.positionCloudsSide,
												this.positionCloudsSide,
												this.positionCloudsSide);
		texture.format = THREE.RedFormat;
		texture.type = THREE.FloatType;
		texture.minFilter = texture.magFilter = THREE.LinearFilter;
		texture.unpackAlignment = 1;
		texture.needsUpdate = true;

		texture.wrapS = THREE.ClampToEdgeWrapping;
		texture.wrapT = THREE.ClampToEdgeWrapping;
		texture.wrapR = THREE.ClampToEdgeWrapping;

		const shader = VolumeRenderShader;

		const uniforms = THREE.UniformsUtils.clone(shader.uniforms);

		uniforms["u_data"].value = texture;
		uniforms["u_size"].value.set(this.positionLimits[3],
									 this.positionLimits[4],
									 this.positionLimits[5]);
		uniforms["u_origin"].value.set(this.positionLimits[0],
									   this.positionLimits[1],
									   this.positionLimits[2]);
		uniforms["u_clim"].value.set(0, this.maxCount);
		// uniforms["u_clim"].value.set(0, 1);
		uniforms["u_renderthreshold"].value = 1; // For ISO renderstyle
		uniforms["u_cmdata"].value = this.colormap;

		return new THREE.ShaderMaterial({
			uniforms,
			vertexShader: shader.vertexShader,
			fragmentShader: shader.fragmentShader,
			side: THREE.BackSide // The volume shader uses the backface as its "reference point"
		});
	}

	/**
	 * Generate the 3D volumetric texture
	 */
	private drawPositionClouds(): void {

		if(this.volumeMesh) this.volumeMesh.material = this.createCloudsMaterial();
	}

	/**
	 * Draw trajectory lines (split in segments to avoid big jumps)
	 */
	private drawLines(atomsCount: number): void {

		sm.clearGroup(this.groupName);

		for(let i=0; i < atomsCount; ++i) {
			const points = this.points[i];
			const segments = this.splitSegments(points, this.maxDisplacement);
			const color = this.traceColor[i];
			for(const segment of segments) {
				const geometry = new THREE.BufferGeometry().setFromPoints(segment);
				const material = new THREE.LineBasicMaterial({color});
				const line = new THREE.Line(geometry, material);
				this.group.add(line);
			}
		}
	}

	/**
	 * Split a trajectory in segments with steps' lengths less than a maximum
	 *
	 * @param points - Points along a path
	 * @param maxLength - Max length of each segment
	 * @returns An array of segments points
	 */
	private splitSegments(points: THREE.Vector3[], maxLength: number): THREE.Vector3[][] {

		// Sanity check
		const npoints = points.length;
		if(npoints < 2) return [];

		const segments: THREE.Vector3[][] = [];
		let segmentStartIndex = 0;
		for(let i=1; i < npoints; ++i) {

			const length = points[i].distanceTo(points[i-1]);
			if(length > maxLength) {

				// Finish previous segment
				if((i-segmentStartIndex) > 1) {
					segments.push(points.slice(segmentStartIndex, i));
				}

				// Start new segment
				segmentStartIndex = i;
			}
		}

		// Output last segment
		if((npoints - segmentStartIndex) > 1) {
			segments.push(points.slice(segmentStartIndex));
		}

		return segments;
	}

	/**
	 * Extract the trace colors as the atom type color
	 *
	 * @param structure - The structure
	 * @param indices - Indices of the selected atoms
	 * @param traceColor - The resulting colors
	 */
	private setTraceColor(structure: Structure,
						  indices: number[],
						  traceColor: string[]): void {

		const len = indices.length;
		traceColor.length = len;
		const {atoms} = structure;
		let i = 0;
		for(const idx of indices) {
			const {atomZ} = atoms[idx];
			traceColor[i++] = atomColor(atomZ);
		}
	}

	/**
	* Save the node status
	*
	* @returns The JSON formatted status to be saved
	*/
	saveStatus(): string {

        const statusToSave = {
			showTrajectories: this.showTrajectories,
			labelKind: this.labelKind,
			atomsSelector: this.atomsSelector,
			maxDisplacement: this.maxDisplacement,
			showPositionClouds: this.showPositionClouds,
			positionCloudsSideExp: this.positionCloudsSideExp,
			positionCloudsGrow: this.positionCloudsGrow,
        };
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
