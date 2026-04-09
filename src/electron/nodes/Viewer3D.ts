/**
 * Interface to the Viewer3D component.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-08
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
import {NodeCore} from "../modules/NodeCore";
import {askClient} from "../modules/ToClient";
import type {Viewer3DState, ChannelDefinition, CtrlParams} from "@/types";

export class Viewer3D extends NodeCore {

	private rawStatus = "";

	private readonly channels: ChannelDefinition[] = [
		{name: "init", type: "invoke", callback: this.channelInit.bind(this)},
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
		return "Controls for the 3D viewer parameters grouped under eight collapsable categories";
	}

	// > Load/save status
	async saveStatus(): Promise<string> {

		this.rawStatus = await askClient(this.id, "state");
        return this.rawStatus;
	}

	loadStatus(params: Viewer3DState): void {

		this.rawStatus = JSON.stringify(params);
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			rawStatus: this.rawStatus
		};
	}
}
