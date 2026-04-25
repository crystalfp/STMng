/**
 * Compute enthalpy transition under pressure changes.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-04-23
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
import {quickHull} from "@derschmale/tympanum";
import {NodeCore} from "../modules/NodeCore";
import {sendAlertToClient, sendToClient} from "../modules/ToClient";
import {EnthalpyTransitionAccumulator} from "../transition/Accumulator";
import type {ChannelDefinition, CtrlParams, Structure} from "@/types";
import {dialog} from "electron";
import {closeSync, openSync, writeSync} from "node:fs";

export class EnthalpyTransition extends NodeCore {

	private structure: Structure | undefined;
	private enableAnalysis = false;
	private readonly accumulator = new EnthalpyTransitionAccumulator();
	private vertices: number[] = [];
	private idxVertices: number[] = [];
	private pressure: number[] = [];

	private readonly channels: ChannelDefinition[] = [
		{name: "capture",	type: "invoke",	callback: this.channelCapture.bind(this)},
		{name: "save",		type: "send",	callback: this.channelSave.bind(this)},
		{name: "reset",     type: "send",   callback: this.channelReset.bind(this)},
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

	description(): string {
		return "Compute enthalpy transitions under pressure changes";
	}

	override fromPreviousNode(data: Structure): void {

		if(!data?.atoms.length) {
			this.accumulator.clear();
			sendToClient(this.id, "load", {
				countAccumulated: 0,
				status: ""
			});
			return;
		}
		this.structure = data;

		if(this.enableAnalysis) {

			const status = this.accumulator.add(data);
			this.computeEnvelope();
			this.sendResultTable(status);
		}
		else {
			sendToClient(this.id, "load", {
				countAccumulated: this.accumulator.size(),
			});
		}
	}

	// > Load/save status
	saveStatus(): string {

		return "";
	}

	loadStatus(): void {

		// No body necessary
	}

	// > Compute
	/**
	 * Compute envelope of the [volume, energy] points
	 */
	private computeEnvelope(): void {

		if(this.accumulator.size() < 3) {
			this.vertices = [];
			this.idxVertices = [];
			this.pressure = [];
			return;
		}

		const points = this.accumulator.getEnvelopePoints();
		const hull = quickHull(points);
		const toOrder: {v: number; e: number; idx: number}[] = [];

		for(const facet of hull) {
			if(facet.plane[1] < -1e-4) {
				const [v1, v2] = facet.verts;

				toOrder.push({v: points[v1][0], e: points[v1][1], idx: v1},
							 {v: points[v2][0], e: points[v2][1], idx: v2});
			}
		}

		// Sort convex hull points by increasing volume value
		toOrder.sort((a, b) => {
			if(a.v !== b.v) return a.v - b.v;
			return a.e - b.e;
		});

		// Remove duplicated convex hull points
    	let len = toOrder.length;
		const vertices = [toOrder[0].v, toOrder[0].e];
		const idxVertices = [toOrder[0].idx];
	    for(let i=0, j=1; j < len; ++j) {
			if(Math.abs(toOrder[i].v-toOrder[j].v) > 1e-4 ||
			   Math.abs(toOrder[i].e-toOrder[j].e) > 1e-4) {
				vertices.push(toOrder[j].v, toOrder[j].e);
				idxVertices.push(toOrder[j].idx);
				i = j;
			}
		}

		// Find minimal energy
		let minEnergy = Number.POSITIVE_INFINITY;
		let idxMin = 0;
		len = idxVertices.length;
		for(let i=0; i < len; ++i) {
			const energy = vertices[2*i+1];
			if(energy < minEnergy) {
				minEnergy = energy;
				idxMin = i;
			}
		}

		this.vertices.length = 0;
		this.idxVertices.length = 0;
		this.pressure.length = 0;

		// Starting point
		this.vertices.push(vertices[2*idxMin], vertices[2*idxMin+1]);
		this.idxVertices.push(idxVertices[idxMin]);
		this.pressure.push(0);
		let currentPressure = 0;

		len = idxVertices.length;
		for(let i=idxMin+1; i < len; ++i) {

			const i2 = 2*i;
			this.vertices.push(vertices[i2], vertices[i2+1]);
			this.idxVertices.push(idxVertices[i]);
			currentPressure += (vertices[i2+1] - vertices[i2-1]) / vertices[i2-2];
			this.pressure.push(currentPressure*160.218);
		}
	}
/*
	private computeEnvelope2(): void {

		if(this.accumulator.size() < 2) {
			this.vertices = [];
			this.idxVertices = [];
			this.pressure = [];
			return;
		}

		const intersections = this.accumulator.computeIntersections();
		if(intersections.points.length < 3) {
			this.vertices = [];
			this.idxVertices = [];
			this.pressure = [];
			return;
		}
		const hull = quickHull(intersections.points);
		const toOrder: {p: number; e: number; idx: number}[] = [];

		for(const facet of hull) {
			if(facet.plane[1] < -1e-4) {
				const [v1, v2] = facet.verts;

				toOrder.push({
								p: intersections.points[v1][0],
								e: intersections.points[v1][1],
								idx: v1
							},
							{
								p: intersections.points[v2][0],
								e: intersections.points[v2][1],
								idx: v2
							});
			}
		}

		// Sort convex hull points by increasing pressure value
		toOrder.sort((a, b) => {
			if(a.p !== b.p) return a.p - b.p;
			return a.e - b.e;
		});

		// Remove duplicated convex hull points
    	let len = toOrder.length;
		this.vertices = [toOrder[0].p, toOrder[0].e];
		const idxVertices = [toOrder[0].idx];
	    for(let i=0, j=1; j < len; ++j) {
			if(Math.abs(toOrder[i].p-toOrder[j].p) > 1e-4 ||
			   Math.abs(toOrder[i].e-toOrder[j].e) > 1e-4) {
				this.vertices.push(toOrder[j].p, toOrder[j].e);
				idxVertices.push(toOrder[j].idx);
				i = j;
			}
		}

		console.log("----");
		len = idxVertices.length;
		for(let i=0; i < len; ++i) {
			const pair = intersections.pairs[idxVertices[i]];

			console.log(`[${this.vertices[2*i].toExponential(3)}`,
						`${this.vertices[2*i+1].toExponential(3)}]`,
						`${pair[0]} ${pair[1]}`);
		}
	}*/

	/**
	 * Send results to client
	 *
	 * @param status - Status string from the accumulator
	 */
	private sendResultTable(status: string): void {

		if(status !== "") {
			sendToClient(this.id, "load", {error: status});
			return;
		}

		const steps: number[] = [];
		const formulas: string[] = [];

		for(const idx of this.idxVertices) {

			formulas.push(this.accumulator.getFormula(idx));
			steps.push(this.accumulator.getStep(idx));
		}

		sendToClient(this.id, "load", {
			countAccumulated: this.accumulator.size(),
			steps,
			formulas,
			pressures: this.pressure,
		});
	}


	// > Channel handlers
	/**
	 * Channel handler for accumulate change
	 *
	 * @param params - Accumulate enabling status
	 * @returns Counts and status
	 */
	private channelCapture(params: CtrlParams): CtrlParams {

		let status = "";
		this.enableAnalysis = params.enableAnalysis as boolean ?? false;
		if(this.enableAnalysis && this.structure) {
			status = this.accumulator.add(this.structure);
			this.computeEnvelope();
		}

		return {
			countAccumulated: this.accumulator.size(),
			status
		};
	}

	/**
	 * Channel handler for analyzing the loaded structure
	 */
	private channelSave(): void {

		const file = dialog.showSaveDialogSync({
			title: "Output enthalpy transitions file",
			filters: [{name: "POSCAR", extensions: ["poscar"]}],
		});
		if(!file) return;

		const fd = openSync(file, "w");

		const pos = file.lastIndexOf(".");
		const energyFile = pos > 0 ?
									`${file.slice(0, pos)}.energy` :
									`${file}.energy`;

		const fde = openSync(energyFile, "w");

		for(let i=0; i < this.idxVertices.length; ++i) {
			const idx = this.idxVertices[i];
			const pressure = this.pressure[i];
			writeSync(fd, this.accumulator.entryToPoscar(idx, pressure));
			const energy = this.accumulator.getStructureEnergy(idx);
			writeSync(fde, `${energy.toFixed(6)}\n`);
		}
		closeSync(fd);
		closeSync(fde);

		sendAlertToClient(`Saved enthalpy transition file ${file}`,
						  {level: "success", node: "enthalpyTransition"});
	}

	/**
	 * Channel handler for clearing the accumulated compositions
	 */
	private channelReset(): void {

		this.accumulator.clear();
	}
}
