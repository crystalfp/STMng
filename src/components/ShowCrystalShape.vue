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
import {MeshStandardMaterial, Group, Vector3, CylinderGeometry,
        Float32BufferAttribute, Mesh, DoubleSide, ConeGeometry,
        BufferGeometry, AmbientLight, FrontSide, DirectionalLight,
        Object3D, Color} from "three";
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

/** Initialize the 3D viewer */
const basisVectorGroup = new Group();
const nameBV = "Basis";
const visibleBV = ref(false);
const shapeGroup = new Group();
const nameShape = "Shape";

const sv = new SimpleViewer(".shape-viewer", false, (scene) => {

    basisVectorGroup.name = nameBV;
    basisVectorGroup.visible = visibleBV.value;
    scene.add(basisVectorGroup);
    scene.add(shapeGroup);

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

    sv.setRaycaster("Facet", (object?: Object3D): void => {

        if(!object) {
            millerText.value = "";
            return;
        }

        const {miller} = object.userData as {miller: string};
        millerText.value = miller;
    });
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

/**
 * Render the surface of the crystal shape
 *
 * @param vertices - Surface triangles vertices [x0, y0, z0, x1, y1, z1, ...]
 * @param index - Index of the triangle vertices
 * @param colorIndex - Index of the color of each triangle
 * @param colors - Color of each vertex
 * @param maxColor - Max color index
 * @param millerLabel - Label for each triangle
 * @returns Radius of the bounding sphere
 */
const renderShape = (vertices: number[], index: number[], colorIndex: number[], colors: number[],
                     maxColor: number, millerLabel: string[]): number => {

    // Clear the shape
    sv.clearGroup(nameShape);

    // For each facet
    let idx = 0;
    for(let color=0; color <= maxColor; ++color) {

        const facetVertices: number[] = [];
        const facetIndex: number[] = [];
        const miller = millerLabel[idx/3];
        const surfaceColor = new Color(colors[3*idx], colors[3*idx+1], colors[3*idx+2]);
        let fi = 0;
        for(; colorIndex[idx] === color; ++idx) {

            facetIndex.push(fi++);
            const ia = index[idx]*3;
            facetVertices.push(vertices[ia], vertices[ia+1], vertices[ia+2]);
        }

        const geometry = new BufferGeometry();
        geometry.setIndex(facetIndex);
        geometry.setAttribute("position", new Float32BufferAttribute(facetVertices, 3));
        geometry.computeVertexNormals();

        // Define material
        const material = new MeshStandardMaterial({
            side: FrontSide,
            roughness: 0.5,
            metalness: 0.6,
            color: surfaceColor
        });
        const shape = new Mesh(geometry, material);
        shape.userData = {miller};
        shape.name = "Facet";
        shapeGroup.add(shape);
    }

    // Get bounding box from the rendered shape
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    let meanX = 0;
    let meanY = 0;
    let meanZ = 0;
    let n = 0;
    for(let i=0; i < vertices.length; i+=3) {
        const x = vertices[i];
        const y = vertices[i+1];
        const z = vertices[i+2];
        if(x < minX) minX = x;
        if(x > maxX) maxX = x;
        if(y < minY) minY = y;
        if(y > maxY) maxY = y;
        if(z < minZ) minZ = z;
        if(z > maxZ) maxZ = z;
        meanX += x;
        meanY += y;
        meanZ += z;
        ++n;
    }
    meanX /= n;
    meanY /= n;
    meanZ /= n;
    const r0 = Math.hypot(minX-meanX, minY-meanY, minZ-meanZ);
    const r1 = Math.hypot(maxX-meanX, maxY-meanY, maxZ-meanZ);
    const radius = Math.max(r0, r1);

    // Move the camera to have the surface at the center of the viewer
    cameraCenter = [
        meanX,
        meanY,
        meanZ
    ];
    cameraPosition = [
        cameraCenter[0]+6*radius,
        cameraCenter[1]+6*radius,
        cameraCenter[2]+6*radius
    ];
    cameraZoom = 15/radius;

    sv.setCamera(cameraPosition, cameraCenter, cameraZoom);

    sv.setSceneModified();

    return radius;
};

let vertices: number[] | undefined;
let index: number[] | undefined;

/** Request the initial data and handle subsequent updates */
requestData(windowPath, (params: CtrlParams) => {

    vertices = params.vertices as number[];
    if(!vertices) return;
    const colorIndex = params.colors as number[];
    if(!colorIndex) return;
    const maxColor = params.maxColor as number ?? 1;
    index = params.index as number[];
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

    const radius = renderShape(vertices, index, colorIndex, colors, maxColor, faceMiller);
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
const scale = ref(1);

/**
 * Export the crystal shape as STL file
 */
const exportSTL = (): void => {

    if(!index || !vertices) return;

    const stlVertices = Array<number>(vertices.length);
    for(let i=0; i < vertices.length; ++i) stlVertices[i] = vertices[i]*scale.value;

    const geometry = new BufferGeometry();
    geometry.setIndex(index);
    geometry.setAttribute("position", new Float32BufferAttribute(stlVertices, 3));
    geometry.computeVertexNormals();
    const material = new MeshStandardMaterial({
        side: FrontSide,
        roughness: 0.5,
        metalness: 0.6,
        color: "#333"
    });
    const shape = new Mesh(geometry, material);

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
      <v-label :text="millerText" class="flex-1-1 mr-2 result-label" style="width: 70px"/>
      <v-switch v-model="visibleBV" label="Show basis vectors"
                @update:modelValue="updateVisibility"/>
      <v-number-input v-model="scale" label="STL scale" class="mb-n6 mr-0"
                      :min="1" :max="100" :step="1" />
      <v-btn @click="exportSTL">Export STL</v-btn>
      <v-switch v-model="binary" label="Binary STL" class="ml-2"/>
      <v-btn @click="centerView">Center</v-btn>
      <v-btn v-focus @click="closeWindow(windowPath)">Close</v-btn>
    </v-container>
</v-app>
</template>
