<script setup lang="ts">
/**
 * @component
 * Controls for the converter from structure data to graphical objects.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-27
 */
import * as THREE from "three";
import {ref, watch, computed} from "vue";
import {askNode, receiveFromNodeForRendering, sendToNode} from "@/services/RoutesClient";
import {showAlertMessage, resetAlertMessage} from "@/services/AlertMessage";
import {spriteText, disposeTextInGroup} from "@/services/SpriteText";
import {colorTextureMaterial} from "@/services/HelperMaterials";
import {sm} from "@/services/SceneManager";
import {getBoundingBox} from "@/services/BoundingBox";
import {SpheresCache} from "@/services/SpheresCache";
import type {StructureRenderInfo, PositionType} from "@/types";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// > Get and set ui parameters from the switchboard
const drawKind = ref("ball-and-stick");
const drawQuality = ref(4);
const drawRoughness = ref(0.5);
const drawMetalness = ref(0.6);
const labelKind = ref("symbol");
const showStructure = ref(true);
const showBonds = ref(true);
const showLabels = ref(true);
const shadedBonds = ref(false);
const out = new THREE.Group();
const atomsGroup = new THREE.Group();
const bondsGroup = new THREE.Group();
const labelsGroup = new THREE.Group();
const bondRadius = 0.1;
const sphereSubdivisions   = [0, 0, 1, 3,  9];
const cylinderSubdivisions = [0, 3, 5, 10, 16];
const rCovScale = 0.5;
let renderInfo: StructureRenderInfo;
const outName = "DrawStructure-" + id;
const spheresCache = new SpheresCache(rCovScale, bondRadius, sphereSubdivisions);

resetAlertMessage("system");
askNode(id, "init")
    .then((params) => {

        drawKind.value = params.drawKind as string ?? "ball-and-stick";
        drawQuality.value = params.drawQuality as number ?? 4;
        drawRoughness.value = params.drawRoughness as number ?? 0.5;
        drawMetalness.value = params.drawMetalness as number ?? 0.6;
        labelKind.value = params.labelKind as string ?? "symbol";
        showBonds.value = params.showBonds as boolean ?? true;
        showStructure.value = params.showStructure as boolean ?? true;
        showLabels.value = params.showLabels as boolean ?? true;
        shadedBonds.value = params.shadedBonds as boolean ?? false;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`));

/**
 * Adjust 3D objects characteristics
 */
const adjustMaterials = (): void => {

    const detail = sphereSubdivisions[drawQuality.value];
    const segments = cylinderSubdivisions[drawQuality.value];
    out.traverse((object) => {
        if(object.type !== "Mesh") return;
        const mesh = object as THREE.Mesh;
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.roughness = drawRoughness.value;
        material.metalness = drawMetalness.value;

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
};

/**
 * Create an hydrogen bond (dashed line)
 *
 * @param from - Position of the bond start
 * @param to - Position of the bond end
 * @param group - The output group where to add the bond
 */
const addHBond = (from: PositionType, to: PositionType, group: THREE.Group): void => {

    const material = new THREE.LineDashedMaterial({
                            color: 0x777777,
                            scale: 20,
                            dashSize: 1,
                            gapSize: 1,
                        });

    const points = [
        new THREE.Vector3(from[0], from[1], from[2]),
        new THREE.Vector3(to[0], to[1], to[2]),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    group.add(line);
};

/**
 * Draw a line bond between two atoms of different type
 *
 * @param from - Position of the bond start
 * @param to - Position of the bond end
 * @param colorFrom - Color of the bond start
 * @param colorTo - Color of the bond end
 * @param group - The output group where to add the bond
 */
const addNormalBond = (from: PositionType, to: PositionType,
					   colorFrom: string, colorTo: string, group: THREE.Group): void => {

    const midX = (from[0]+to[0])/2;
    const midY = (from[1]+to[1])/2;
    const midZ = (from[2]+to[2])/2;

    const vertices = [
        from[0], from[1], from[2],
        midX, midY, midZ,
        midX, midY, midZ,
        to[0], to[1], to[2]
    ];

    const c1 = new THREE.Color(colorFrom);
    const c2 = new THREE.Color(colorTo);
    const colors = [
        c1.r, c1.g, c1.b,
        c1.r, c1.g, c1.b,
        c2.r, c2.g, c2.b,
        c2.r, c2.g, c2.b,
    ];

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({vertexColors: true});

    group.add(new THREE.LineSegments(geometry, material));
};

/**
 * Draw a line bond between two atoms of same type
 *
 * @param from - Position of the bond start
 * @param to - Position of the bond end
 * @param color - Common color of the bonded atoms
 * @param group - The output group where to add the bond
 */
const addNormalBondSameAtoms = (from: PositionType, to: PositionType, color: string, group: THREE.Group): void => {

    const start = new THREE.Vector3(from[0], from[1], from[2]);
    const end   = new THREE.Vector3(to[0], to[1], to[2]);

    const material = new THREE.LineBasicMaterial({color});
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    group.add(new THREE.Line(geometry, material));
};

/**
 * Create a cylinder bond
 *
 * @remarks Till now it is not shaded with a color gradient
 * @param from - Position of the bond start
 * @param to - Position of the bond end
 * @param radius - Radius of the bond
 * @param colorStart - Color of the bond start
 * @param colorEnd - Color of the bond end
 * @param group - The output group where to add the bond
 */
const addCylinder = (start: PositionType, end: PositionType,
                     radius: number, colorStart: THREE.ColorRepresentation,
                     colorEnd: THREE.ColorRepresentation, group: THREE.Group): void => {

    const subdivisions = cylinderSubdivisions[drawQuality.value];

    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];
    const len = Math.hypot(dx, dy, dz);
    const geometry = new THREE.CylinderGeometry(radius, radius, len, subdivisions, 1, true);
    const meshMaterial = colorTextureMaterial(new THREE.Color(colorStart),
                                                new THREE.Color(colorEnd),
                                                drawRoughness.value,
                                                drawMetalness.value,
                                                subdivisions,
                                                shadedBonds.value);
    const cylinder = new THREE.Mesh(geometry, meshMaterial);

    setDirection(dx/len, dy/len, dz/len, cylinder.quaternion);

    const midx = (start[0] + end[0])/2;
    const midy = (start[1] + end[1])/2;
    const midz = (start[2] + end[2])/2;
    cylinder.position.set(midx, midy, midz);

    group.add(cylinder);
};

/**
 * Set a quaternion from a direction vector (versor)
 *
 * @param nx - Versor x component
 * @param ny - Versor y component
 * @param nz - Versor z component
 * @param quaternion - The computed quaternion
 */
const setDirection = (nx: number, ny: number, nz: number, quaternion: THREE.Quaternion): void => {

    // Versor is assumed to be normalized
    if(ny > 0.99999) quaternion.set(0, 0, 0, 1);
    else if(ny < -0.99999) quaternion.set(1, 0, 0, 0);
    else {
        const rotationAxis = new THREE.Vector3(nz, 0, -nx).normalize();
        const radians = Math.acos(ny);
        quaternion.setFromAxisAngle(rotationAxis, radians);
    }
};

/**
 * Adjust start and end positions of the bond rendered as cylinder to have a better coloring
 *
 * @param start - Center of the first atom
 * @param end - Center of the second atom
 * @param radiusStart - Radius of the rendered first atom
 * @param radiusEnd - Radius of the rendered second atom
 * @returns Adjusted start and end positions for the bond rendered as cylinder
 */
const adjustLimitsCylinder = (start: PositionType, end: PositionType,
                              radiusStart: number, radiusEnd: number): {start: PositionType; end: PositionType} => {

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
};

/**
 * Convert the structure data into 3D objects
 */
const drawStructure = (): void => {

    // Clear previous structure
    sm.clearGroup(outName);
    atomsGroup.clear();
    bondsGroup.clear();
    labelsGroup.clear();
    out.add(atomsGroup, bondsGroup, labelsGroup);

    // No atoms present, display nothing
    if(renderInfo.atoms.length === 0) return;

    // Render atoms if present
    if(drawKind.value !== "lines") {

        // Prepare spheres
        spheresCache.prepare(drawQuality.value,
                            drawKind.value,
                            renderInfo.atoms,
                            drawRoughness.value,
                            drawMetalness.value);

        // Render atoms
        let index = 0;
        for(const atom of renderInfo.atoms) {

            const {atomZ, position} = atom;

            const sphere = spheresCache.getSphere(atomZ);
            sphere.position.set(position[0], position[1], position[2]);
            sphere.name = "Atom";
            sphere.userData = {index};
            ++index;
            atomsGroup.add(sphere);
        }
    }

    // Render bonds
    switch(drawKind.value) {
        case "ball-and-stick":
            for(const bond of renderInfo.bonds) {

                const atomFrom = renderInfo.atoms[bond.from];
                const atomTo   = renderInfo.atoms[bond.to];
                if(bond.type === 1) addHBond(atomFrom.position, atomTo.position, bondsGroup);
                else {
                    const colorFrom    = atomFrom.color;
                    const colorTo      = atomTo.color;
                    const radiusStart  = atomFrom.rCov*rCovScale;
                    const radiusEnd    = atomTo.rCov*rCovScale;
                    const {start, end} = adjustLimitsCylinder(atomFrom.position, atomTo.position,
                                                              radiusStart, radiusEnd);
                    addCylinder(start, end, bondRadius, colorFrom, colorTo, bondsGroup);
                }
            }
            break;
        case "licorice":
            for(const bond of renderInfo.bonds) {

                const atomFrom = renderInfo.atoms[bond.from];
                const atomTo   = renderInfo.atoms[bond.to];
                if(bond.type === 1) addHBond(atomFrom.position, atomTo.position, bondsGroup);
                else {
                    const colorFrom = atomFrom.color;
                    const colorTo   = atomTo.color;
                    addCylinder(atomFrom.position, atomTo.position,
                                bondRadius, colorFrom, colorTo, bondsGroup);
                }
            }
            break;
        case "lines":
            for(const bond of renderInfo.bonds) {

                const atomFrom = renderInfo.atoms[bond.from];
                const atomTo   = renderInfo.atoms[bond.to];
                if(bond.type === 1) addHBond(atomFrom.position, atomTo.position, bondsGroup);
                else if(atomFrom.atomZ === atomTo.atomZ) {
                    const {color, position} = atomFrom;
                    addNormalBondSameAtoms(position, atomTo.position, color, bondsGroup);
                }
                else {
                    const colorFrom = atomFrom.color;
                    const colorTo   = atomTo.color;
                    addNormalBond(atomFrom.position, atomTo.position, colorFrom, colorTo, bondsGroup);
                }
            }
            break;
    }

    // Find the camera rotation center and position based
    // on the structure bounding box
    sm.setBoundingBox(getBoundingBox(renderInfo));
};

/**
 * Draw the atoms labels
 *
 * @param data - The structure data
 */
const drawLabels = (): void => {

    // Remove existing labels
    disposeTextInGroup(labelsGroup);

    const {atoms} = renderInfo;

    // No atoms present or no label requested, display nothing
    if(!atoms || atoms.length === 0 || !showLabels.value) return;

    // Render labels
    const color = "#FFFFFF";
    let idx = 0;
    for(const atom of atoms) {

        let offset = 0;
        switch(drawKind.value) {
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
        }

        let labelText;
        switch(labelKind.value) {
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

        const atomLabel = spriteText(labelText, color, atom.position, [0, 0, offset]);
        labelsGroup.add(atomLabel);

        ++idx;
    }

    // Without this the labels do not appear on redraw
    labelsGroup.updateMatrix();
};

// Receive new structure from main process
receiveFromNodeForRendering(id, "structure", (updatedRenderInfo: StructureRenderInfo) => {

    renderInfo = updatedRenderInfo;
    adjustMaterials();
    drawStructure();
    drawLabels();
});

// Change draw parameters
watch([labelKind, drawKind, shadedBonds], () => {

    if(renderInfo) {
        drawStructure();
        drawLabels();
    }
    sendToNode(id, "save", {
        labelKind: labelKind.value,
        drawKind: drawKind.value,
        shadedBonds: shadedBonds.value
    });
});

// Change visibility
watch([showStructure, showBonds, showLabels], () => {

    labelsGroup.visible = showLabels.value;
    bondsGroup.visible = showBonds.value;
    out.visible = showStructure.value;
    sendToNode(id, "save", {
        showStructure: showStructure.value,
        showBonds: showBonds.value,
        showLabels: showLabels.value
    });
});

// Change material parameters
watch([drawRoughness, drawMetalness, drawQuality], () => {

    adjustMaterials();
    sendToNode(id, "save", {
        drawRoughness: drawRoughness.value,
        drawMetalness: drawMetalness.value,
        drawQuality: drawQuality.value
    });
});

// Convert the button toggle into three booleans
const showCombined = computed({
    get: () => {
        const result = [];
        if(showStructure.value) result.push("structure");
        if(showBonds.value) result.push("bonds");
        if(showLabels.value) result.push("labels");
        return result;
    },
    set: (values) => {
        showStructure.value = values.includes("structure");
        showBonds.value = values.includes("bonds");
        showLabels.value = values.includes("labels");
    }
});

// Name the groups (useful for debugging)
atomsGroup.name  = "Atoms";
bondsGroup.name  = "Bonds";
labelsGroup.name = "Labels";
out.name         = outName;

// Combine the groups
out.add(atomsGroup, bondsGroup, labelsGroup);

// Add to the scene
sm.add(out);

</script>


<template>
<v-container class="container">
  <v-label text="Structure rendering mode" class="mb-3 ml-2 mt-4 no-select" /><br>
  <v-btn-toggle v-model="drawKind" color="primary" mandatory class="mb-6 ml-2">
    <v-btn value="ball-and-stick">CPK</v-btn>
    <v-btn value="van-der-waals">VdW</v-btn>
    <v-btn value="licorice">Licorice</v-btn>
    <v-btn value="lines">Lines</v-btn>
  </v-btn-toggle>

  <v-switch v-model="shadedBonds" color="primary"
            label="Smooth color bonds" density="compact" class="mt-2 ml-2" />

  <v-label text="Label is" class="mb-3 ml-2 no-select" /><br>
  <v-btn-toggle v-model="labelKind" color="primary" mandatory class="mb-6 ml-2">
    <v-btn value="symbol">Symbol</v-btn>
    <v-btn value="label">Label</v-btn>
    <v-btn value="index">Index</v-btn>
  </v-btn-toggle><br>

  <v-label text="Visibility" class="ml-2 mb-3 no-select" /><br>
  <v-btn-toggle v-model="showCombined" multiple color="primary" mandatory class="ml-2 mb-4">
    <v-btn value="structure">Structure</v-btn>
    <v-btn value="bonds">Bonds</v-btn>
    <v-btn value="labels">Labels</v-btn>
  </v-btn-toggle>

  <v-label text="Quality" class="ml-2 no-select" /><br>
  <v-btn-toggle v-model="drawQuality" color="primary" mandatory class="mt-2 ml-2">
    <v-btn :value="1">Low</v-btn>
    <v-btn :value="2">Medium</v-btn>
    <v-btn :value="3">Good</v-btn>
    <v-btn :value="4">Best</v-btn>
  </v-btn-toggle>

  <g-debounced-slider v-slot="{value}" v-model="drawRoughness"
                      :min="0" :max="1" :step="0.1" class="ml-2 mt-6">
    <v-label :text="`Roughness (${value.toFixed(2)})`" class="no-select" />
  </g-debounced-slider>
  <g-debounced-slider v-slot="{value}" v-model="drawMetalness"
                      :min="0" :max="1" :step="0.1" class="ml-2 mt-4">
    <v-label :text="`Metalness (${value.toFixed(2)})`" class="no-select" />
  </g-debounced-slider>
</v-container>
</template>
