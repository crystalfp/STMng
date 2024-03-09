

import {LineGeometry} from "three/examples/jsm/lines/LineGeometry.js";
import {LineMaterial} from "three/examples/jsm/lines/LineMaterial.js";
import {Line2} from "three/examples/jsm/lines/Line2.js";

class FatAxesHelper extends Line2 {
  constructor(size = 1, linewidth = 6, color = 0xFFFFFF) {
    const vertices = [
      0, 0, 0,   size, 0, 0,
      0, 0, 0,   0, size, 0,
      0, 0, 0,   0, 0, size
    ];

    const geometry = new LineGeometry();
    geometry.setPositions(vertices);

    const material = new LineMaterial({
      color,
      linewidth,
    });
    material.resolution.set(window.innerWidth, window.innerHeight); // resolution of the viewport
    material.worldUnits = false;

    super(geometry, material);
    // @ts-expect-error Type does not exist
    this.type = "FatAxesHelper";
    this.computeLineDistances();
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// Usage
// const arrows = new FatAxesHelper(axisLength, 20, 0xFF0000);
// group.add(arrows);
