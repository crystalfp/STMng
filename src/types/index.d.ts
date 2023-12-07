import * as THREE from "three";

export interface Viewer3DConfiguration {

    camera: {
        perspective: boolean;
        orthoSide: number;
    };
    scene: {
        background: THREE.ColorRepresentation;
        showGrid: boolean;
        showAxis: boolean;
        quality: number;
    };
    lights: {
        ambientColor?: THREE.ColorRepresentation;
        ambientIntensity?: number;
        directional1Color?: THREE.ColorRepresentation;
        directional1Intensity?: number;
        directional1Position?: [number, number, number];
        directional2Color?: THREE.ColorRepresentation;
        directional2Intensity?: number;
        directional2Position?: [number, number, number];
        directional3Color?: THREE.ColorRepresentation;
        directional3Intensity?: number;
        directional3Position?: [number, number, number];
    };
}


export type Object3D = {
    type: "sphere";
    radius: number;
    position: [number, number, number];
    color: THREE.ColorRepresentation;
} |
{
    type: "cube";
    sides: [number, number, number];
    position: [number, number, number];
    color: THREE.ColorRepresentation;
} |
{
    type: "cylinder";
    radius: number;
    start: [number, number, number];
    end: [number, number, number];
    colorStart: THREE.ColorRepresentation;
    colorEnd: THREE.ColorRepresentation;
};

export interface Atom {
    position: [number, number, number];
    Z: number;
}

type BondType = "normal" | "hydrogen";

export interface Bond {
    from: number;
    to: number;
    kind: BondType;
}
