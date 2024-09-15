/**
 * Types definitions used by the client.
 *
 * @packageDocumentation
 */

export interface NodeUI {
	id: string;
	ui: string;
	in?: string;
	label: string;
}

// TBD Definition of the chart data
export interface ChartOptions {
    responsive: boolean;
    maintainAspectRatio: boolean;
    plugins: {
      title: {
          text: string;
          display: boolean;
          font: Record<string, number | string>;
      };
    };
    scales: {
      x: {
        title: {
          color: string;
          display: boolean;
          text: string;
        };
        grid: Record<string, string>;
      };
      y: {
        title: {
          color: string;
          display: boolean;
          text: string;
        };
        grid: Record<string, string>;
      };
    };
}

export interface ChartData {
    labels: string[];
    datasets: {
            label: string;
            backgroundColor: string;
            data: number[];
            borderColor: string;
    }[];
}
export interface ChartParams {
    data: ChartData;
    options: ChartOptions;
    type: string;
}

// > The project structure
interface GraphNode {

    /** The label that appears on the node selector */
	label: string;

    /** The type of the node (valid values in NodeInfo.ts) */
	type: string;

    /** Comma separated list of node ids from which the node takes inputs */
	in?: string;
}

import type {UiParams} from "@/services/Switchboard";
import type {PositionType} from "../../new/types";

type ProjectGraph = Record<string, GraphNode>; // The key is the node id

export interface Project {
    graph: ProjectGraph;
    currentId?: string;
    viewer?: {
        camera: {
            type: "perspective" | "orthographic";
            position: PositionType;
            lookAt: PositionType;
            snapshotFormat: string;
        };
        scene: {
            background: string;
        };
        lights: {
            ambientColor: string;
            ambientIntensity: number;
            directional1Color: string;
            directional1Intensity: number;
            directional2Color: string;
            directional2Intensity: number;
            directional3Color: string;
            directional3Intensity: number;
            directional1Position: PositionType;
            directional2Position: PositionType;
            directional3Position: PositionType;
        };
        helpers: {
            showAxis: boolean;
            showGridXZ: boolean;
            showGridXY: boolean;
            showGridYZ: boolean;
            gridSize: number;
            axisLength: number;
        };
    };
    ui?: Record<string, UiParams>;
}
