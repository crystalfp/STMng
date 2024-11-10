declare module "troika-three-text" {

	import type {Mesh, Color} from "three";

	class Text extends Mesh {

		constructor();
		sync(): void;
		dispose(): void;

		public text: string;
		public fontSize: number;
		public fontWeight: string;
		public font: string;
		public textAlign: "left" | "right" | "center" | "justify";
		public color: string|number|Color;
		public anchorX: "left" | "center" | "right";
		public anchorY: "top" | "top-baseline" | "top-cap" | "top-ex" | "middle" | "bottom-baseline" | "bottom";
	}
}
