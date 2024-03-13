import * as THREE from "three";
declare module "troika-three-text" {

	declare class Text extends THREE.Mesh {
		constructor();
		sync(): void;

		public text: string;
		public fontSize: number;
		public fontWeight: string;
		public font: string;
		public color: string|number|THREE.Color;
		public anchorX: "left" | "center" | "right";
		public anchorY: "top" | "top-baseline" | "top-cap" | "top-ex" | "middle" | "bottom-baseline" | "bottom";
	}
}
