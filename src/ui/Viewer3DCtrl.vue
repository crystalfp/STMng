<script setup lang="ts">
/**
 * @component
 * Controls for the viewer.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */

import {computed, ref, watch} from "vue";
import {useConfigStore} from "@/stores/configStore";
import {useControlStore} from "@/stores/controlStore";
import {askNode, sendViewer3DState} from "@/services/RoutesClient";
import {showSystemAlert} from "@/services/AlertMessage";
import AlignLabels from "@/widgets/AlignLabels.vue";
import BlockButton from "@/widgets/BlockButton.vue";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

/** Convert degrees to radiants */
const DEG2RAD = Math.PI/180;
const RAD2DEG = 1/DEG2RAD;

// > Access the store
const configStore = useConfigStore();
const controlStore = useControlStore();

/**
 * Up axis for the conversion of position to angles and reverse
 * @notExported
 */
const UpAxis = {
    x: 0,
    y: 1,
    z: 2,
} as const;

/**
 * Up axis type
 * @notExported
 */
type UpType = (typeof UpAxis)[keyof typeof UpAxis];

/**
 * Convert unit sphere coordinates to 3D polar angles
 *
 * @param position - Coordinates on the unit sphere
 * @param up - Vertical axis
 * @returns Polar angles
 */
const positionToAngles = (position: [x: number, y: number, z: number],
                          up: UpType): {alpha: number; beta: number} => {

    const [x, y, z] = position;
    let theta = 0;
    let phi = 0;

    switch(up) {
        case UpAxis.x:
            theta = Math.acos(y);
            phi = Math.sign(z)*Math.acos(y/Math.hypot(y, z));
            break;
        case UpAxis.y:
            theta = Math.acos(z);
            phi = Math.sign(x)*Math.acos(z/Math.hypot(z, x));
            break;
        case UpAxis.z:
            theta = Math.acos(x);
            phi = Math.sign(y)*Math.acos(x/Math.hypot(x, y));
            break;
    }
    const dp = phi*RAD2DEG;
    return {
        alpha: dp > 180 ? 360-dp : dp,
        beta: 90 - theta*RAD2DEG
    };
};

/**
 * Convert 3D polar angles to unit sphere coordinates
 *
 * @param alpha - Azimuthal angle around the vertical axis (degrees -180..180)
 * @param beta - Polar angle from the perpendicular to the vertical axis plane (degrees -90..90)
 * @param up - Vertical axis
 * @returns Coordinates on the unit sphere
 */
const anglesToPosition = (alpha: number,
                          beta: number,
                          up: UpType): {x: number; y: number; z: number} => {

    const theta = (90 - beta)*DEG2RAD;
    const phi = (alpha < 0 ? 360 + alpha : alpha)*DEG2RAD;

    const sinTheta = Math.sin(theta);

    switch(up) {
        case UpAxis.x:
            return {
                y: sinTheta*Math.cos(phi),
                z: sinTheta*Math.sin(phi),
                x: Math.cos(theta)
            };
        case UpAxis.y:
            return {
                z: sinTheta*Math.cos(phi),
                x: sinTheta*Math.sin(phi),
                y: Math.cos(theta)
            };
        case UpAxis.z:
            return {
                x: sinTheta*Math.cos(phi),
                y: sinTheta*Math.sin(phi),
                z: Math.cos(theta)
            };
    }
};

// Initialize the parameters
askNode(id, "init")
    .then((params) => {

        configStore.restoreState(params.rawStatus as string);
    })
    .catch((error: Error) => {
        showSystemAlert(`Error from UI init for ${label}: ${error.message}`);
    });

// Send state on request from main process
sendViewer3DState(id, "state", () => configStore.statusToSave);

// > First directional light
const {alpha: a1, beta: b1} = positionToAngles(configStore.lights.directional1Position, UpAxis.x);
const alpha1 = ref(a1);  // Around X on YZ plane
const beta1 = ref(b1);   // Angle with X axis

watch([alpha1, beta1], () => {
    const {x, y, z} = anglesToPosition(alpha1.value, beta1.value, UpAxis.x);
    configStore.lights.directional1Position[0] = x;
    configStore.lights.directional1Position[1] = y;
    configStore.lights.directional1Position[2] = z;
});

// > Second directional light
const {alpha: a2, beta: b2} = positionToAngles(configStore.lights.directional2Position, UpAxis.y);
const alpha2 = ref(a2);
const beta2 = ref(b2);

watch([alpha2, beta2], () => {
    const {x, y, z} = anglesToPosition(alpha2.value, beta2.value, UpAxis.y);
    configStore.lights.directional2Position[0] = x;
    configStore.lights.directional2Position[1] = y;
    configStore.lights.directional2Position[2] = z;
});

// > Third directional light
const {alpha: a3, beta: b3} = positionToAngles(configStore.lights.directional3Position, UpAxis.z);
const alpha3 = ref(a3);
const beta3 = ref(b3);

watch([alpha3, beta3], () => {
    const {x, y, z} = anglesToPosition(alpha3.value, beta3.value, UpAxis.z);
    configStore.lights.directional3Position[0] = x;
    configStore.lights.directional3Position[1] = y;
    configStore.lights.directional3Position[2] = z;
});

// > Positioning camera
const forcedCameraPositionX = ref(configStore.camera.forcePosition[0]);
const forcedCameraPositionY = ref(configStore.camera.forcePosition[1]);
const forcedCameraPositionZ = ref(configStore.camera.forcePosition[2]);

const forcedCameraLookAtX = ref(configStore.camera.forceLookAt[0]);
const forcedCameraLookAtY = ref(configStore.camera.forceLookAt[1]);
const forcedCameraLookAtZ = ref(configStore.camera.forceLookAt[2]);

/**
 * Load the current camera position and lookAt in the user interface
 */
const loadPosition = (): void => {

    forcedCameraPositionX.value = configStore.camera.position[0];
    forcedCameraPositionY.value = configStore.camera.position[1];
    forcedCameraPositionZ.value = configStore.camera.position[2];

    forcedCameraLookAtX.value = configStore.camera.lookAt[0];
    forcedCameraLookAtY.value = configStore.camera.lookAt[1];
    forcedCameraLookAtZ.value = configStore.camera.lookAt[2];
};

/**
 * Set the camera position and lookAt to the ones set in the user interface
 */
const forcePosition = (): void => {

    configStore.camera.position[0] = forcedCameraPositionX.value;
    configStore.camera.position[1] = forcedCameraPositionY.value;
    configStore.camera.position[2] = forcedCameraPositionZ.value;

    configStore.camera.lookAt[0] = forcedCameraLookAtX.value;
    configStore.camera.lookAt[1] = forcedCameraLookAtY.value;
    configStore.camera.lookAt[2] = forcedCameraLookAtZ.value;

    configStore.camera.forcePosition[0] = forcedCameraPositionX.value;
    configStore.camera.forcePosition[1] = forcedCameraPositionY.value;
    configStore.camera.forcePosition[2] = forcedCameraPositionZ.value;

    configStore.camera.forceLookAt[0] = forcedCameraLookAtX.value;
    configStore.camera.forceLookAt[1] = forcedCameraLookAtY.value;
    configStore.camera.forceLookAt[2] = forcedCameraLookAtZ.value;

    controlStore.force = true;
};

/** Simplify camera type label */
const cameraType = computed(() => `Camera type (${configStore.camera.type})`);

</script>


<template>
<v-container class="container pr-2 pl-0">
  <v-expansion-panels class="mt-2">
    <v-expansion-panel>
      <v-expansion-panel-title>
        {{ cameraType }}
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-btn-toggle v-model="configStore.camera.type" mandatory
                      class="mb-n2 w-100 justify-center">
          <v-btn slim value="perspective">Perspective</v-btn>
          <v-btn slim value="orthographic">Orthographic</v-btn>
        </v-btn-toggle>
      </v-expansion-panel-text>
    </v-expansion-panel>

    <v-expansion-panel>
      <v-expansion-panel-title>
        Camera positioning
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-label text="Camera position" class="mb-4 no-select" />
        <v-row class="pl-1">
          <v-number-input v-model="forcedCameraPositionX" label="x"
                          :step="0.1" :precision="1" class="ml-2 mr-0" />
          <v-number-input v-model="forcedCameraPositionY" label="y"
                          :step="0.1" :precision="1" class="ml-2 mr-0" />
          <v-number-input v-model="forcedCameraPositionZ" label="z"
                          :step="0.1" :precision="1" class="ml-2 mr-0" />
        </v-row>
        <v-label text="Camera look at" class="mb-4 no-select" />
        <v-row class="pl-1">
          <v-number-input v-model="forcedCameraLookAtX" label="x"
                          :step="0.1" :precision="1" class="ml-2 mr-0" />
          <v-number-input v-model="forcedCameraLookAtY" label="y"
                          :step="0.1" :precision="1" class="ml-2 mr-0" />
          <v-number-input v-model="forcedCameraLookAtZ" label="z"
                          :step="0.1" :precision="1" class="ml-2 mr-0" />
        </v-row>
        <v-row class="d-flex justify-center gc-2 pl-3 pb-1">
          <v-btn density="comfortable" @click="loadPosition">Load current</v-btn>
          <v-btn density="comfortable" @click="forcePosition">Force position</v-btn>
        </v-row>
      </v-expansion-panel-text>
    </v-expansion-panel>

    <v-expansion-panel>
      <v-expansion-panel-title>
        Camera position auto reset
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-switch v-model="configStore.camera.autoReset" label="Enable position auto reset"
                  class="ml-2 mt-1"/>
      </v-expansion-panel-text>
    </v-expansion-panel>

    <v-expansion-panel>
      <v-expansion-panel-title>
        Scene
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-label text="Background color" class="mb-2 no-select" />
        <v-color-picker v-model="configStore.scene.background"
                        :modes="['rgb', 'hsl', 'hex']" elevation="0" />
      </v-expansion-panel-text>
    </v-expansion-panel>

    <v-expansion-panel>
      <v-expansion-panel-title>
        Depth cueing
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-switch v-model="configStore.scene.depthCueing" label="Enable depth cueing" class="ml-2 mt-1" />
        <v-row class="pl-1 mt-4">
          <v-number-input v-model="configStore.scene.depthNear" label="Near"
                          :disabled="!configStore.scene.depthCueing"
                          :step="1" :precision="0" class="ml-2 mr-0" />
          <v-number-input v-model="configStore.scene.depthFar" label="Far"
                          :disabled="!configStore.scene.depthCueing"
                          :step="1" :precision="0" class="ml-2 mr-0" />
        </v-row>
      </v-expansion-panel-text>
    </v-expansion-panel>

    <v-expansion-panel>
      <v-expansion-panel-title>
        Ambient light
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-label text="Light color" class="mb-2 no-select" />
        <v-color-picker v-model="configStore.lights.ambientColor"
                        :modes="['rgb', 'hsl', 'hex']" elevation="0" />
        <v-slider v-model="configStore.lights.ambientIntensity" label="Intensity" density="comfortable"
                  min="0" max="3" step="0.1" thumb-label />
      </v-expansion-panel-text>
    </v-expansion-panel>

    <v-expansion-panel>
      <v-expansion-panel-title>
        Directional lights
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-label text="Directional light 1" class="mb-2 no-select" />
        <v-color-picker v-model="configStore.lights.directional1Color"
                        :modes="['rgb', 'hsl', 'hex']" elevation="0" />
        <align-labels label-width="4.5rem">
          <v-slider v-model="configStore.lights.directional1Intensity" label="Intensity" density="compact"
                    min="0" max="3" step="0.1" thumb-label />
          <v-slider v-model="alpha1" label="Around X" density="compact"
                    min="-180" max="180" step="1" thumb-label />
          <v-slider v-model="beta1" label="Along X" density="compact"
                    min="-90" max="90" step="1" thumb-label />
        </align-labels>
        <v-label text="Directional light 2" class="mb-2 no-select" />
        <v-color-picker v-model="configStore.lights.directional2Color"
                        :modes="['rgb', 'hsl', 'hex']" elevation="0" />
        <align-labels label-width="4.5rem">
          <v-slider v-model="configStore.lights.directional2Intensity" label="Intensity" density="compact"
                    min="0" max="3" step="0.1" thumb-label />
          <v-slider v-model="alpha2" label="Around Y" density="compact"
                    min="-180" max="180" step="1" thumb-label />
          <v-slider v-model="beta2" label="Along Y" density="compact"
                    min="-90" max="90" step="1" thumb-label />
        </align-labels>
        <v-label text="Directional light 3" class="mb-2 no-select" />
        <v-color-picker v-model="configStore.lights.directional3Color"
                        :modes="['rgb', 'hsl', 'hex']" elevation="0" />
        <align-labels label-width="4.5rem">
          <v-slider v-model="configStore.lights.directional3Intensity" label="Intensity" density="compact"
                    min="0" max="3" step="0.1" thumb-label />
          <v-slider v-model="alpha3" label="Around Z" density="compact"
                    min="-180" max="180" step="1" thumb-label />
          <v-slider v-model="beta3" label="Along Z" density="compact"
                    min="-90" max="90" step="1" thumb-label />
        </align-labels>
      </v-expansion-panel-text>
    </v-expansion-panel>

    <v-expansion-panel>
      <v-expansion-panel-title>
        Helper objects
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-switch v-model="configStore.helpers.showAxis"
                  label="Show axis" class="mt-3 mb-4" />
        <align-labels label-width="5rem" class="ml-n4 mt-n5">
          <v-slider v-model="configStore.helpers.axisLength" label="Axis length" density="compact"
                    min="0.5" max="20" step="0.5" thumb-label />
        </align-labels>
        <v-switch v-model="configStore.helpers.showGridXZ"
                  label="Show grid XZ" class="mt-n6" />
        <v-switch v-model="configStore.helpers.showGridXY"
                  label="Show grid XY" />
        <v-switch v-model="configStore.helpers.showGridYZ"
                  label="Show grid YZ" />
        <align-labels label-width="5rem" class="ml-n4">
          <v-slider v-model="configStore.helpers.gridSize" label="Grid side" density="compact"
                    min="2" max="40" step="2" thumb-label />
        </align-labels>
        <v-switch v-model="configStore.helpers.showGizmo"
                  label="Show orientation helper" class="mt-n6" />
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
  <block-button class="mt-2 ml-1" @click="configStore.resetViewer" label="Restore viewer settings"/>
</v-container>
</template>
