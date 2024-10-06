/**
 * Cache the atoms' sphere geometries
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-10-06
 */
import * as THREE from "three";
import type {AtomRenderInfo} from "@/types";


export class SpheresCache {

	private readonly sphereSubdivisions = [0, 0, 1, 3, 9];
	private currentKind: 0 | 1 | 2 = 0;
	private currentQuality: number = this.sphereSubdivisions.length - 1;
	private subdivisions: number = this.sphereSubdivisions[this.currentQuality];

	// Geometries to be cloned
	private licoriceGeometry: THREE.IcosahedronGeometry | undefined;
	private readonly ballAndStickGeometry = new Map<number, THREE.IcosahedronGeometry>();
	private readonly vanDerWaalsGeometry = new Map<number, THREE.IcosahedronGeometry>();

	// Materials to be cloned
	private readonly meshMaterial = new Map<number, THREE.MeshStandardMaterial>();
	private currentMetalness = -1;
	private currentRoughness = -1;

	constructor(private readonly covScale: number, private readonly licoriceRadius: number) {}

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
													  new THREE.IcosahedronGeometry(radius, this.subdivisions));
					}
				}
				break;
			case "van-der-waals":
				this.currentKind = 1;
				for(const atom of atoms) {
					const {atomZ, rVdW} = atom;
					if(!this.vanDerWaalsGeometry.has(atomZ)) {

						this.vanDerWaalsGeometry.set(atomZ,
													  new THREE.IcosahedronGeometry(rVdW, this.subdivisions));

					}
				}
				break;
			case "licorice":
				this.currentKind = 2;
				if(!this.licoriceGeometry) {
					this.licoriceGeometry = new THREE.IcosahedronGeometry(this.licoriceRadius,
																		  this.subdivisions);
				}
				break;
		}

		for(const atom of atoms) {

			const {atomZ, color} = atom;
			if(!this.meshMaterial.has(atomZ)) {
				this.meshMaterial.set(atomZ,
									  new THREE.MeshStandardMaterial({
										color,
										roughness: this.currentRoughness,
										metalness: this.currentMetalness,
										side: THREE.FrontSide,
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
	getSphere(atomZ: number): THREE.Mesh {

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
		return new THREE.Mesh(geometry, material);
	}
}
