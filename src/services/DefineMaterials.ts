import * as THREE from "three";
import {useConfigStore} from "@/stores/configStore";
import {watchEffect} from "vue";

let objQuality: number;
let objRoughness: number;
let objMetalness: number;

export const setMaterialParams = (): void => {

    const configStore = useConfigStore();

    objQuality   = configStore.materials.quality;
    objRoughness = configStore.materials.roughness;
    objMetalness = configStore.materials.metalness;
};

export const adjustMaterials = (group: THREE.Group): void => {
    const configStore = useConfigStore();
    const sphereSubdivisions = [2, 4, 6, 10];
    const cylinderSubdivisions = [4, 8, 16, 32];

    watchEffect(() => {
        const {roughness, metalness, quality} = configStore.materials;
        const detail = sphereSubdivisions[quality];
        const segments = cylinderSubdivisions[quality];
        group.traverse((object) => {
            if(object.type !== "Mesh") return;
            const mesh = object as THREE.Mesh;
            const material = mesh.material as THREE.MeshStandardMaterial;
            material.roughness = roughness;
            material.metalness = metalness;

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
    });
};

export const getQuality = (): number => {return objQuality;};

export const createColorTextureMaterial = (colorFrom: THREE.Color,
									colorTo: THREE.Color,
									width: number): THREE.Material => {

    const height = 2;
    const size = width * height;
    const data = new Uint8Array(4 * size);

    const rf = Math.floor(colorFrom.r * 255);
    const gf = Math.floor(colorFrom.g * 255);
    const bf = Math.floor(colorFrom.b * 255);

    for(let i = 0; i < width; ++i) {
        const stride = i * 4;
        data[stride] = rf;
        data[stride + 1] = gf;
        data[stride + 2] = bf;
        data[stride + 3] = 255;
    }

    const rt = Math.floor(colorTo.r * 255);
    const gt = Math.floor(colorTo.g * 255);
    const bt = Math.floor(colorTo.b * 255);
    for(let i = width; i < size; ++i) {
        const stride = i * 4;
        data[stride] = rt;
        data[stride + 1] = gt;
        data[stride + 2] = bt;
        data[stride + 3] = 255;
    }

    // used the buffer to create a DataTexture
    const texture = new THREE.DataTexture(data, width, height);
    texture.needsUpdate = true;

	return new THREE.MeshStandardMaterial({
        roughness: objRoughness,
        metalness: objMetalness,
        side: THREE.FrontSide,
        map: texture
    });
};


export const createMaterial = (color: THREE.ColorRepresentation): THREE.Material => {

    return new THREE.MeshStandardMaterial({
        color,
        roughness: objRoughness,
        metalness: objMetalness,
        side: THREE.DoubleSide,
    });
};
