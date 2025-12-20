declare module "troika-three-text" {

	import type {Mesh, Color, MeshBasicMaterial, MeshStandardMaterial} from "three";

	declare function preloadFont(options: {font: string, characters: string}, callback: () => void): void;

	class Text extends Mesh {

		constructor();
		sync(): void;
		dispose(): void;

		public text: string;
		public font: string;
		public fontSize: number;
    	public fontWeight: "normal" | "bold";
    	public fontStyle: "normal" | "italic";
		public textAlign: "left" | "right" | "center" | "justify";
		public color: string | number | Color;
    	public maxWidth: number;
    	public lineHeight: number;
    	public letterSpacing: number;
    	public material: MeshBasicMaterial | MeshStandardMaterial;
    	public clipRect: [number, number, number, number];
    	public depthOffset: number;
    	public direction: "auto" | "ltr" | "rtl";
    	public overflowWrap: "normal" | "break-word";
    	public whiteSpace: "normal" | "nowrap";
    	public outlineWidth: number;
    	public outlineOffsetX: number;
    	public outlineOffsetY: number;
    	public outlineColor: string | number;
    	public outlineOpacity: number;
    	public strokeWidth: number;
    	public strokeColor: string | number | Color;
    	public strokeOpacity: number;
    	public curveRadius: number;
    	public fillOpacity: number;
    	public glyphGeometryDetail: number;
    	public gpuAccelerateSDF: boolean;
    	public outlineBlur: number;
    	public sdfGlyphSize: number;
    	public textIndent: number;
    	public unicodeFontsUrl: string;
		public anchorX: "left" | "center" | "right";
		public anchorY: "top" | "top-baseline" | "top-cap" | "top-ex" |
						"middle" | "bottom-baseline" | "bottom";
	}

	export class BatchedText extends Text {

		constructor();
		update(camera: Camera): void;
		addText(text: TroikaText): Text;
		add(text: TroikaText): Text;
		public _members: Map<Text, string>;
		public _text: string;
		public _scale: Vector3;
	}
}
