<script setup lang="ts">
/**
 * @component
 * Show the resulting shape of a crystal.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-06-13
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import {ref} from "vue";
import {MeshStandardMaterial, Group, Vector3, CylinderGeometry, Object3D,
        Float32BufferAttribute, Mesh, DoubleSide, ConeGeometry,
        BufferGeometry, AmbientLight, FrontSide, DirectionalLight,
        Int32BufferAttribute, type Intersection} from "three";
import {STLExporter} from "three/addons/exporters/STLExporter.js";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {theme} from "@/services/ReceiveTheme";
import {SimpleViewer} from "@/services/SimpleViewer";
import {Lut} from "three/addons/math/Lut.js";
import {closeWindow, requestData, sendToNode} from "@/services/RoutesClient";
import {spriteText} from "@/services/SpriteText";
import type {CtrlParams, PositionType} from "@/types";

const windowPath = "/crystal-shape";

let id = "";
let faceMiller: string[] = [];
const millerText = ref("");

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

/**
 * Handle intersection with a face
 *
 * @param object - Clicked on object
 * @param intersects - The intersection result from the raycaster
 */
const raycasterHandler = (object?: Object3D, intersects?: Intersection): void => {

    if(!object || !intersects) {
        millerText.value = "";
        return;
    }

    const mesh = object as Mesh;
    const vertices = mesh.geometry.getAttribute("position");
    const va = vertices.array;
    const nv = vertices.array.length/3;
    const close = [];
    for(let i=0, i3=0; i < nv; ++i, i3 +=3) {
        const dist = intersects.point.distanceTo(new Vector3(va[i3], va[i3+1], va[i3+2]));
        const obj = {
            index: i3,
            dist: dist
        };
        close.push(obj);
    }
    close.sort((a, b) => a.dist - b.dist);

    const ci = close[0].index;
    const point = new Vector3(va[ci], va[ci+1], va[ci+2]);

    const index = mesh.geometry.index!.array;

    const faces = [];
    const ntri = vertices.array.length/9;
    for(let i=0, i3=0; i < ntri; ++i, i3+=3) {

        const ia = index[i3]*3;
        const ib = index[i3+1]*3;
        const ic = index[i3+2]*3;

        const vertexa = new Vector3(va[ia], va[ia+1], va[ia+2]);
        const vertexb = new Vector3(va[ib], va[ib+1], va[ib+2]);
        const vertexc = new Vector3(va[ic], va[ic+1], va[ic+2]);

        if(point.equals(vertexa) ||
            point.equals(vertexb) ||
            point.equals(vertexc)) faces.push([ia, ib, ic, i]);
    }

    const centroids = [];
    for(const idx of faces) {
        const vA = [va[idx[0]], va[idx[0]+1], va[idx[0]+2]];
        const vB = [va[idx[1]], va[idx[1]+1], va[idx[1]+2]];
        const vC = [va[idx[2]], va[idx[2]+1], va[idx[2]+2]];

        const meanX = (vA[0]+vB[0]+vC[0])/3;
        const meanY = (vA[1]+vB[1]+vC[1])/3;
        const meanZ = (vA[2]+vB[2]+vC[2])/3;
        const vObj = {
            index: idx[3],
            v: new Vector3(meanX, meanY, meanZ)
        };

        centroids.push(vObj);
    }

    const closeCentroids = [];

    for(let i = 0; i < centroids.length; i++) {
        const dist = intersects.point.distanceTo(centroids[i].v);
        const obj = {
            index: i,
            dist: dist
        };
        closeCentroids.push(obj);
    }
    closeCentroids.sort((a, b) => a.dist - b.dist);

    const faceIdx = centroids[closeCentroids[0].index].index;
    millerText.value = faceMiller[faceIdx];
};

/** Initialize the 3D viewer */
const basisVectorGroup = new Group();
const nameBV = "Basis";
const visibleBV = ref(false);

const sv = new SimpleViewer(".shape-viewer", false, (scene) => {

    basisVectorGroup.name = nameBV;
    basisVectorGroup.visible = visibleBV.value;
    scene.add(basisVectorGroup);

    // Increase ambient light intensity
    scene.traverse((object) => {
        if(object.type !== "AmbientLight") return;
        const light = object as AmbientLight;
        light.intensity = 1;
    });

    // Add another light
    const light = new DirectionalLight("white", 3);
    light.position.set(0.5, -0.5, 0.5);
    scene.add(light);

    sv.setRaycaster("Shape", raycasterHandler);
});

/** Camera position for centering */
let cameraCenter: [x: number, y: number, z: number] = [0, 0, 0];
let cameraPosition: [x: number, y: number, z: number] = [1, 1, 1];
let cameraZoom = 1;

/**
 * Create an arrow in the direction of the basis vector
 *
 * @param basis - Basis vector to be show
 * @param origin - Unit cell origin
 * @param size - Base size of the arrows
 * @param color - Color of the arrow and the label
 * @param axisLabel - Label on the vector
 * @param group - The arrow is added to this group
 */
const basisVectorArrow = (basis: Vector3, origin: Vector3, size: number,
                          color: string, axisLabel: string, group: Group): void => {

    const versor = basis.clone().normalize();
    const basisLen = basis.length();

    const coneSize = 2*size;
    const coneLen = 5*size;

    const material = new MeshStandardMaterial({
        color,
        roughness: 0.5,
        metalness: 0.6,
        side: DoubleSide,
    });

    const cylinder = new Mesh(
        new CylinderGeometry(size, size, basisLen-coneLen, 10),
        material
    );

    cylinder.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), versor);
    cylinder.position.addVectors(origin, versor.clone().multiplyScalar((basisLen-coneLen)/2));

    // Arrow tips
    const cone = new Mesh(
        new ConeGeometry(coneSize, coneLen, 10, 1),
        material
    );

    cone.quaternion.copy(cylinder.quaternion);
    cone.position.addVectors(basis, origin);
    cone.position.addScaledVector(versor, -coneLen/2);

    // Correlate label size to axis length for legibility
    const labelSize = size*4;

    // Label
    const labelPosition: PositionType = [
        basis.x+origin.x+versor.x*size,
        basis.y+origin.y+versor.y*size,
        basis.z+origin.z+versor.z*size
    ];
    const sprite = spriteText(axisLabel, color, labelSize, labelPosition);

    group.add(cylinder, cone, sprite);
};

/**
 * Render the basis vectors
 *
 * @param center - Origin of the axis
 * @param radius - Bounding box sphere radius of the crystal shape
 * @param basis - Structure basis vectors
 */
const renderBasisVectors = (center: [x: number, y: number, z: number],
                            radius: number, basis: number[]): void => {

    // Clear the basis vectors
    sv.clearGroup(nameBV);

    const origin = new Vector3(center[0], center[1], center[2]);

    const basisA = new Vector3(basis[0], basis[1], basis[2]);
    const basisB = new Vector3(basis[3], basis[4], basis[5]);
    const basisC = new Vector3(basis[6], basis[7], basis[8]);

    // Find the size of the arrows related to the shorter axis
    const la = basisA.length();
    const lb = basisB.length();
    const lc = basisC.length();
    const lmin = Math.min(la, lb, lc);
    const scale = 1.6*radius/lmin;
    const width = scale/8;

	basisA.multiplyScalar(scale);
	basisB.multiplyScalar(scale);
	basisC.multiplyScalar(scale);

	basisVectorArrow(basisA, origin, width, "#FF0000", "a", basisVectorGroup);
	basisVectorArrow(basisB, origin, width, "#79FF00", "b", basisVectorGroup);
	basisVectorArrow(basisC, origin, width, "#0000FF", "c", basisVectorGroup);

    sv.setSceneModified();
};

let shape: Mesh | undefined;

/**
 * Render the surface of the crystal shape
 *
 * @param vertices - Surface triangles vertices [x0, y0, z0, x1, y1, z1, ...]
 * @param index - Index of the triangle vertices
 * @param colors - Color of each vertex
 * @returns Radius of the bounding sphere
 */
const renderShape = (vertices: number[], index: number[], colors: number[], faceIndex: number[]): number => {

    const surfaceName = "Shape";

    // Remove existing surface
    const scene = sv.getScene();
    const mesh = scene.getObjectByName(surfaceName) as Mesh;
    if(mesh) {
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
        mesh.removeFromParent();
    }

    // Build the geometry
    const geometry = new BufferGeometry();
    geometry.setIndex(index);
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.setAttribute("customID", new Int32BufferAttribute(faceIndex, 1));

    // Define material
    const material = new MeshStandardMaterial({
        side: FrontSide,
        roughness: 0.5,
        metalness: 0.6,
        vertexColors: true
    });

    // Move the camera to have the surface at the center of the viewer
    geometry.computeBoundingSphere();
    const bs = geometry.boundingSphere;
    if(bs) {

        cameraCenter = [
            bs.center.x,
            bs.center.y,
            bs.center.z
        ];
        cameraPosition = [
            cameraCenter[0]+6*bs.radius,
            cameraCenter[1]+6*bs.radius,
            cameraCenter[2]+6*bs.radius
        ];
        cameraZoom = 8/bs.radius;
    }
    else {
        cameraPosition = [1, 1, 1];
        cameraCenter = [0, 0, 0];
        cameraZoom = 1;
    }
    sv.setCamera(cameraPosition, cameraCenter, cameraZoom);

    // Create shape
    shape = new Mesh(geometry, material);
    shape.name = surfaceName;
    scene.add(shape);
    sv.setSceneModified();

    return bs?.radius ?? 1;
};

/** Request the initial data and handle subsequent updates */
requestData(windowPath, (params: CtrlParams) => {

    const vertices = params.vertices as number[];
    if(!vertices) return;
    const colorIndex = params.colors as number[];
    if(!colorIndex) return;
    const maxColor = params.maxColor as number ?? 1;
    const index = params.index as number[];
    if(!index) return;
    const basis = params.basis as number[];
    if(!basis) return;
    id = params.id as string ?? "";
    faceMiller = params.faceMiller as string[] ?? [];

    // Transform color index into color per vertex
    const lut = new Lut("rainbow", maxColor+1);
    lut.setMax(maxColor);
    lut.setMin(0);

    const cnt = colorIndex.length;
    const colors = Array<number>(cnt*3).fill(0);
    for(let i=0; i < cnt; ++i) {

        const {r, g, b} = lut.getColor(colorIndex[i]);
        const i3 = i*3;
        colors[i3]   = r;
        colors[i3+1] = g;
        colors[i3+2] = b;
    }

    const radius = renderShape(vertices, index, colors, colorIndex);
    renderBasisVectors(cameraCenter, radius, basis);
});

/**
 * Center the camera
 */
const centerView = (): void => {

    sv.setCamera(cameraPosition, cameraCenter, cameraZoom);
};

/**
 * Update axis vectors visibility
 *
 * @param visible - Toggle position
 */
const updateVisibility = (visible: boolean | null): void => {

    basisVectorGroup.visible = visible ?? false;
    sv.setSceneModified();
};

const binary = ref(true);

/**
 * Export the crystal shape as STL file
 */
const exportSTL = (): void => {

    if(!shape) return;
    const exporter = new STLExporter();
    const result = exporter.parse(shape, {binary: binary.value}) as unknown;

    sendToNode(id, "stl", {
        binary: binary.value,
        content: binary.value ? (result as DataView<ArrayBuffer>).buffer : result as string,
    });
};

</script>


<template>
<v-app :theme class="layout-app">
    <div class="layout-main shape-viewer" />
    <v-container class="layout-buttons">
      <v-label :text="millerText" class="flex-1-1 mr-2 result-label"/>
      <v-switch v-model="visibleBV" label="Show basis vectors"
                @update:modelValue="updateVisibility"/>
      <v-btn @click="exportSTL">Export STL</v-btn>
      <v-switch v-model="binary" label="Binary STL" class="ml-2"/>
      <v-btn @click="centerView">Center</v-btn>
      <v-btn v-focus @click="closeWindow(windowPath)">Close</v-btn>
    </v-container>
</v-app>
</template>
