import * as THREE from "three";

export interface Viewer3DConfiguration {

    camera: {
        perspective: boolean;
        orthoSide: number;
    };
    scene: {
        background: string;
        showGrid: boolean;
        showAxis: boolean;
    };
    lights: {
        ambientColor: string;
        ambientIntensity: number;
        directional1Color: string;
        directional1Intensity: number;
        directional1Position: [number, number, number];
        directional2Color: string;
        directional2Intensity: number;
        directional2Position: [number, number, number];
        directional3Color: string;
        directional3Intensity: number;
        directional3Position: [number, number, number];
    };
    materials: {
        quality: number;
        roughness: number;
        metalness: number;
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

export interface ProjectElement {
    id: string;
    label: string;
    ui: string;
    in: string;
}

export interface Project {
    elements: ProjectElement[];
}

export interface ChartData {
    x: number[];
    y: number[];
}
