/**
 * Capture movie from the viewer
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-09-16
 */
import {Output, BufferTarget, CanvasSource, QUALITY_HIGH,
		Mp4OutputFormat, MkvOutputFormat, WebMOutputFormat} from "mediabunny";
import {askNode} from "@/services/RoutesClient";
import {showNodeAlert, showSystemAlert} from "@/services/AlertMessage";

/**
 * Capture the viewer into a movie file
 */
export class CaptureMovie {

    private readonly out: Output<WebMOutputFormat | Mp4OutputFormat | MkvOutputFormat, BufferTarget>;
    private readonly source: CanvasSource;
    private run = false;
    private timestamp = 0;
    private readonly FRAME_MSEC: number;
    private readonly FRAME_SEC: number;
    private readonly width: number;
    private readonly height: number;

    /**
     * Initialize the movie capturer
     *
     * @param canvas - The viewer3D canvas
     * @param extension - The save filename extension that determines the movie format
     * @param fps - Movie frames per second
	 * @param width - Canvas width
	 * @param height - Canvas height
     */
    constructor(canvas: HTMLCanvasElement, extension: string, fps: number,
				width: number, height: number) {

        // Frame duration
        this.FRAME_MSEC = Math.round(1000/fps);
        this.FRAME_SEC  = this.FRAME_MSEC/1000;

        // Frame dimensions
        this.width  = width;
        this.height = height;
		if(this.width % 2 !== 0 || this.height % 2 !== 0) {

			this.width = Math.floor(this.width/2)*2;
			this.height = Math.floor(this.height/2)*2;
		}

        // Initialize the formatter and frame capturer
        let formatter;
        let codec: "avc" | "hevc" | "vp9" | "av1" | "vp8" = "avc";
		switch(extension) {
			case ".webm":
				formatter = new WebMOutputFormat({appendOnly: true});
                codec = "vp9";
				break;
			case ".mp4":
				formatter = new Mp4OutputFormat({fastStart: "in-memory"});
				break;
			case ".mkv":
				formatter = new MkvOutputFormat();
				break;
			default:
				throw Error(`Movie with extension "${extension}" is not supported`);
		}

        this.out = new Output({
            format: formatter,
            target: new BufferTarget()
        });

        this.source = new CanvasSource(canvas, {
            codec,
            bitrate: QUALITY_HIGH,
        });

        this.out.addVideoTrack(this.source, {frameRate: fps});
    }

    /**
     * Capture the frames and at the end save them to the file
     *
     * @param filename - Output movie filename
     */
    async saveFrames(filename: string): Promise<void> {

        await this.out.start();
        this.run = true;
        while(this.run) {

            const pr1 = this.source!.add(this.timestamp, this.FRAME_SEC);
            const pr2 = new Promise((resolve) => setTimeout(resolve, this.FRAME_MSEC));
            await Promise.all([pr1, pr2]);
            this.timestamp += this.FRAME_SEC;
        }
        await this.out.finalize();
        if(!this.out.target.buffer) throw Error("Invalid output buffer");

        const {buffer} = this.out.target;
        askNode("SYSTEM", "movie", {buffer, filename})
            .then((sts) => {
                if(sts.error) throw Error(sts.error as string);
                if(sts.payload) {
					const message = `Saved movie file ${sts.payload as string}`;
                    showNodeAlert(message, "captureMovie", {level: "success"});
					showSystemAlert(message, "success");
                }
            })
            .catch((error: Error) => {
                showNodeAlert(error.message, "captureMovie");
				showSystemAlert(error.message, "error");
            });
    }

    /**
     * Stop the frame capture and write the movie file
     */
    finishFrames(): void {
        this.run = false;
    }
}
