/**
 * Computes and display the X-Ray Diffraction pattern of a crystal structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-11-04
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {ipcMain, dialog} from "electron";
import {writeFileSync} from "node:fs";
import {NodeCore} from "../modules/NodeCore";
import {XRDCalculator, type DiffractionPatternResult} from "../modules/XRDCalculator";
import {createOrUpdateSecondaryWindow, isSecondaryWindowOpen,
		sendToSecondaryWindow} from "../modules/WindowsUtilities";
import {sendAlertToClient, sendToClient} from "../modules/ToClient";
import {hasUnitCell} from "../modules/Helpers";
import type {Structure, CtrlParams, ChannelDefinition} from "@/types";

interface LineCoordinates {
	x: number[];
	y: number[];
}
export class DiffractionPattern extends NodeCore {

	private structure: Structure | undefined;
	private readonly xrd = new XRDCalculator();
	private xy: DiffractionPatternResult = {twoTheta: [], intensity: [], label: []};
	private channelSavePointsOpened = false;
	private lineCoordinates: LineCoordinates = {x: [], y: []};

	// Mirror of the UI reactive state
	private readonly state = {
		scaled: true,
		thetaLow: 0,
		thetaHigh: 180,
		width: 0.75,
		wavelengthCode: "CuKa",
		wavelengthNumeric: 1.5,
		showHKL: false
	};

	private readonly channels: ChannelDefinition[] = [
		{name: "init",    type: "invoke", callback: this.channelInit.bind(this)},
		{name: "open",    type: "send",   callback: this.channelOpen.bind(this)},
		{name: "compute", type: "send",   callback: this.channelCompute.bind(this)},
	];

	/**
	 * Create the node
	 *
	 * @param id - The node ID
	 */
	constructor(id: string) {
		super(id);
		this.setupChannels(id, this.channels);
	}

	override fromPreviousNode(data: Structure): void {

		this.structure = data;
		const hasData = Boolean(data) && hasUnitCell(data.crystal.basis);

		// There is the structure so the XRD could be computed
		sendToClient(this.id, "enable", {enableComputation: hasData});

		if(hasData && isSecondaryWindowOpen("/chart")) {

			// Compute spectra
			try {
				this.xy = this.xrd.getDiffractionPattern(this.structure,
														 this.state.wavelengthCode,
														 this.state.scaled,
														 this.state.thetaLow,
														 this.state.thetaHigh);
			}
			catch(error: unknown) {
				sendAlertToClient(`Error in getDiffractionPattern: ${(error as Error).message}`);
				return;
			}

			// Compute chart data
			const dataToSend = this.createDataForChart();

			// Update window
			sendToSecondaryWindow("/chart", dataToSend);
		}
	}

	// > Load/save status
	saveStatus(): string {
		return `"${this.id}": ${JSON.stringify(this.state)}`;
	}

	private initializeState(params: CtrlParams): void {
		this.state.scaled = params.scaled as boolean ?? true;
		this.state.thetaLow = params.thetaLow as number ?? 0;
		this.state.thetaHigh = params.thetaHigh as number ?? 180;
		this.state.width = params.width as number ?? 0.25;
		this.state.wavelengthCode = params.wavelengthCode as string ?? "CuKa";
		this.state.wavelengthNumeric = params.wavelengthNumeric as number ?? 1.5;
		this.state.showHKL = params.showHKL as boolean ?? false;
	}

	loadStatus(params: CtrlParams): void {
		this.initializeState(params);
	}

	/**
	 * Create and pack the data for the chart viewer
	 *
	 * @returns Data to be sent to the chart viewer
	 */
	private createDataForChart(): CtrlParams {

		// Normalize the peaks
		const len = this.xy.intensity.length;
		const y = [...this.xy.intensity];
		if(this.state.width > 0) {
			const mult = 0.9394372786996513/this.state.width;
			for(let i=0; i < len; ++i) {
				y[i] *= mult;
			}
		}

		// And scale them to 100
		if(this.state.scaled) {
			let maxValue = -1;
			for(let i=0; i < len; ++i) {
				if(y[i] > maxValue) maxValue = y[i];
			}
			const scale = 100/maxValue;
			for(let i=0; i < len; ++i) y[i] *= scale;
		}

		// Chart of the line spectra
		this.lineCoordinates = this.state.width > 0 ?
									this.smoothPeaks(this.xy.twoTheta,
													 y,
													 this.state.thetaLow,
													 this.state.thetaHigh,
													 this.state.width) :
									this.hardPeaks(this.xy,
												   this.state.thetaLow,
												   this.state.thetaHigh);

		return {
			labelX: this.xy.twoTheta,
			labelY: y,
			labelText: this.xy.label,
			labelShow: this.state.showHKL,
			lineX: this.lineCoordinates.x,
			lineY: this.lineCoordinates.y,
			lineSmooth: this.state.width > 0,
			range: [this.state.thetaLow, this.state.thetaHigh],
		};
	}

	/**
	 * Smooth the diffraction peaks using a gaussian
	 *
	 * @param x - Peak intensities
	 * @param y - Peak position
	 * @param min - Theta min value
	 * @param max - Theta max value
	 * @param width - Width of the gaussian to be used to smooth the peaks (FWHM)
	 * @returns Array of points coordinates to be used in the chart
	 */
	private smoothPeaks(x: number[],
						y: number[],
						min: number,
						max: number,
						width: number): LineCoordinates {

		const xOut: number[] = [];
		const yOut: number[] = [];

		const step = (max-min)/2_000;
		for(let xx=min; xx <= max; xx += step) {
			xOut.push(xx);
			yOut.push(0);
		}
		const nPoints = xOut.length;

		const len = x.length;
		for(let i=0; i < len; ++i) {

			const mean = x[i];
			const peak = y[i];
			const den = width**2/2.772588722239781;

			for(let j=0; j < nPoints; ++j) {
				yOut[j] += peak*Math.exp(-((xOut[j]-mean)**2)/den);
			}
		}
		if(this.state.scaled) {

			let maxIntensity = 0;
			for(let j=0; j < nPoints; ++j) {
				if(yOut[j] > maxIntensity) maxIntensity = yOut[j];
			}
			const scale = 100/maxIntensity;
			for(let j=0; j < nPoints; ++j) {
				yOut[j] *= scale;
			}
		}
		return {x: xOut, y: yOut};
	}

	/**
	 * The computed diffraction peaks without smoothing
	 *
	 * @param xy - The computed diffraction pattern
	 * @param min - Theta min value
	 * @param max - Theta max value
	 * @returns Array of points coordinates to be used in the chart
	 */
	private hardPeaks(xy: DiffractionPatternResult,
					  min: number,
					  max: number): LineCoordinates {

		const len = xy.intensity.length;
		let scale = 1;
		if(this.state.scaled) {

			let maxIntensity = 0;
			for(let j=0; j < len; ++j) {
				if(xy.intensity[j] > maxIntensity) maxIntensity = xy.intensity[j];
			}
			scale = maxIntensity > 0 ? 100/maxIntensity : 1;
		}

		const x: number[] = [min];
		const y: number[] = [0];
		for(let i=0; i < len; ++i) {
			const mean = xy.twoTheta[i];
			const peak = xy.intensity[i]*scale;
			x.push(mean, mean, mean);
			y.push(0, peak, 0);
		}
		x.push(max);
		y.push(0);
		return {x, y};
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			enableComputation: Boolean(this.structure),
			scaled: this.state.scaled,
			thetaLow: this.state.thetaLow,
			thetaHigh: this.state.thetaHigh,
			width: this.state.width,
			wavelengthCode: this.state.wavelengthCode,
			wavelengthCodes: this.xrd.getWavelengthNames(),
			wavelengthNumeric: this.state.wavelengthNumeric
		};
	}

	/**
	 * Channel handler for compute and show diffraction pattern if the window is already open
	 */
	private channelCompute(params: CtrlParams): void {

		const wavelengthCode = params.wavelengthCode as string ?? "CuKa";
		const wavelengthNumeric = params.wavelengthNumeric as number ?? 1.5;
		const thetaLow = params.thetaLow as number ?? 0;
		const thetaHigh = params.thetaHigh as number ?? 180;
		const scaled = params.scaled as boolean ?? true;

		const recompute = this.state.wavelengthCode !== wavelengthCode ||
							this.state.wavelengthNumeric !== wavelengthNumeric ||
							this.state.thetaLow !== thetaLow ||
							this.state.thetaHigh !== thetaHigh ||
							this.state.scaled !== scaled;

		this.state.wavelengthCode = wavelengthCode;
		this.state.wavelengthNumeric = wavelengthNumeric;
		this.state.thetaLow = thetaLow;
		this.state.thetaHigh = thetaHigh;
		this.state.scaled = scaled;
		this.state.width = params.width as number ?? 0.25;
		this.state.showHKL = params.showHKL as boolean ?? false;

		// Compute spectra if the view window is open
		if(this.structure && isSecondaryWindowOpen("/chart")) {

			if(recompute) {
				try {
					this.xy = this.xrd.getDiffractionPattern(this.structure,
															 this.state.wavelengthCode,
															 this.state.scaled,
															 this.state.thetaLow,
															 this.state.thetaHigh,
															 this.state.wavelengthNumeric);
				}
				catch(error: unknown) {
					sendAlertToClient(`Error in getDiffractionPattern: ${(error as Error).message}`);
					return;
				}
			}

			// Compute chart data
			const dataToSend = this.createDataForChart();

			// Update window
			sendToSecondaryWindow("/chart", dataToSend);
		}
	}

	/**
	 * Channel handler for compute and show diffraction pattern when the chart window is requested
	 */
	private channelOpen(): void {

		if(this.structure) {

			// Compute spectra
			try {
				this.xy = this.xrd.getDiffractionPattern(this.structure,
														 this.state.wavelengthCode,
														 this.state.scaled,
														 this.state.thetaLow,
														 this.state.thetaHigh,
														 this.state.wavelengthNumeric);
			}
			catch(error: unknown) {
				sendAlertToClient(`Error in getDiffractionPattern: ${(error as Error).message}`);
				return;
			}

			// Compute chart data
			const dataToSend = this.createDataForChart();

			// if already open, update chart, otherwise create the window
			createOrUpdateSecondaryWindow({
				routerPath: "/chart",
				width: 1150,
				height: 800,
				title: "X-Ray diffraction pattern",
				data: dataToSend
			});

			if(!this.channelSavePointsOpened) {
				this.channelSavePointsOpened = true;

				ipcMain.on("SYSTEM:save-xrd", () => {

					const file = dialog.showSaveDialogSync({
						title: "Save X-Ray diffraction points",
						filters: [
							{name: "Point data", extensions: ["dat"]},
						]
					});
					if(file) {
						try {
							let out = "";
							const len = this.lineCoordinates.x.length;
							for(let i=0; i < len; ++i) {
								out += this.lineCoordinates.x[i].toFixed(4);
								out += ` ${this.lineCoordinates.y[i].toExponential(8)}\n`;
							}
							writeFileSync(file, out, "utf8");
						}
						catch(error: unknown) {
							sendAlertToClient(`Error in save-xrd: ${(error as Error).message}`);
						}
					}
				});

				ipcMain.on("SYSTEM:save-png", (_event, payload: {dataURI: string}) => {

					const file = dialog.showSaveDialogSync({
						title: "Save X-Ray diffraction chart snapshot",
						filters: [
							{name: "PNG", extensions: ["png"]},
						]
					});
					if(!file) return;

					const data = payload.dataURI.split(",");
					writeFileSync(file, Buffer.from(data[1], "base64"));
				});
			}
		}
	}
}
