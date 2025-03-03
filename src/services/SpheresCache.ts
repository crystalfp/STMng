/**
 * Cache the atoms' sphere geometries
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-10-06
 */
import {IcosahedronGeometry, MeshStandardMaterial, FrontSide, Mesh} from "three";
import type {AtomRenderInfo} from "@/types";


export class SpheresCache {

	private currentKind: 0 | 1 | 2 = 0;
	private currentQuality: number;
	private subdivisions: number;

	// Geometries to be cloned
	private licoriceGeometry: IcosahedronGeometry | undefined;
	private readonly ballAndStickGeometry = new Map<number, IcosahedronGeometry>();
	private readonly vanDerWaalsGeometry = new Map<number, IcosahedronGeometry>();

	// Materials to be cloned
	private readonly meshMaterial = new Map<number, MeshStandardMaterial>();
	private currentMetalness = -1;
	private currentRoughness = -1;

	private readonly covScale: number;
	private readonly licoriceRadius: number;
	private readonly sphereSubdivisions: number[];

	/**
	 * Constructor
	 *
	 * @param covScale - Scale for sphere diameter in ball and stick rendering
	 * @param licoriceRadius - Radius of the sphere for licorice rendering
	 * @param sphereSubdivisions - Table of sphere subdivisions for each rendering quality
	 */
	constructor(covScale: number, licoriceRadius: number, sphereSubdivisions: number[]) {

		this.covScale = covScale;
		this.licoriceRadius = licoriceRadius;
		this.sphereSubdivisions = sphereSubdivisions;
		this.currentQuality = this.sphereSubdivisions.length - 1;
		this.subdivisions = this.sphereSubdivisions[this.currentQuality];
	}

	/**
	 * Cache the graphical structures
	 *
	 * @param quality - Rendering quality
	 * @param kind - Draw kind. It is: "ball-and-stick", "van-der-waals", "licorice"
	 * @param atoms - List of atoms from renderInfo
	 * @param roughness - Surface roughness
	 * @param metalness - Surface metalness
	 */
	prepare(quality: number, kind: string, atoms: AtomRenderInfo[], roughness: number, metalness: number): void {

		// If quality changes, invalidate the cache
		if(quality !== this.currentQuality) {

			this.licoriceGeometry = undefined;
			this.vanDerWaalsGeometry.clear();
			this.ballAndStickGeometry.clear();

			this.subdivisions = this.sphereSubdivisions[quality];
			this.currentQuality = quality;
		}

		// Initialize the material cache
		if(roughness !== this.currentRoughness || metalness !== this.currentMetalness) {

			this.meshMaterial.clear();
			this.currentRoughness = roughness;
			this.currentMetalness = metalness;
		}

		switch(kind) {
			case "ball-and-stick":
				this.currentKind = 0;
				for(const atom of atoms) {
					const {atomZ, rCov} = atom;
					if(!this.ballAndStickGeometry.has(atomZ)) {

						const radius = rCov * this.covScale;
						this.ballAndStickGeometry.set(atomZ,
													  new IcosahedronGeometry(radius, this.subdivisions));
					}
				}
				break;
			case "van-der-waals":
				this.currentKind = 1;
				for(const atom of atoms) {
					const {atomZ, rVdW} = atom;
					if(!this.vanDerWaalsGeometry.has(atomZ)) {

						this.vanDerWaalsGeometry.set(atomZ,
													  new IcosahedronGeometry(rVdW, this.subdivisions));

					}
				}
				break;
			case "licorice":
				this.currentKind = 2;
				if(!this.licoriceGeometry) {
					this.licoriceGeometry = new IcosahedronGeometry(this.licoriceRadius,
																	this.subdivisions);
				}
				break;
		}

		for(const atom of atoms) {

			const {atomZ, color} = atom;
			if(!this.meshMaterial.has(atomZ)) {
				this.meshMaterial.set(atomZ,
									  new MeshStandardMaterial({
										color,
										roughness: this.currentRoughness,
										metalness: this.currentMetalness,
										side: FrontSide,
									  }));
			}
		}
	}

	/**
	 * Return the sphere mesh cached for the given atom type
	 *
	 * @param atomZ - Atom to be returned
	 * @returns Sphere mesh to be positioned and rendered
	 */
	getSphere(atomZ: number): Mesh {

		const material = this.meshMaterial.get(atomZ)!.clone();
		let geometry;

		switch(this.currentKind) {

			case 1: // van-der-waals
				geometry = this.vanDerWaalsGeometry.get(atomZ)!.clone();
				break;

			case 2: // licorice
				geometry = this.licoriceGeometry!.clone();
				break;

			default: // ball-and-stick
				geometry = this.ballAndStickGeometry.get(atomZ)!.clone();
				break;
		}
		return new Mesh(geometry, material);
	}
}
