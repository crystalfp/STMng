/**
 * Base class for all nodes.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {ipcMain} from "electron";
import type {Structure, UiInfo, CtrlParams, ViewerState, ChannelDefinition} from "../../types";

/** Observer routine provided by another node */
type Observer = (data: Structure) => void;

interface ObserverEntry {
	observer: Observer;
	node: NodeCore;
}

export abstract class NodeCore {

	/** Name of the child class */
	protected abstract readonly name: string;

	/** List of observers from subscribe to this node */
	private readonly observersList: ObserverEntry[] = [];

	/**
	 * Add an observer to the current node
	 *
	 * @param observer - The observer routine
	 * @param node - The node that contains the observer routine
	 */
	subscribe(observer: Observer, node: NodeCore): void {

		this.observersList.push({observer, node});
	}

	/**
	 * Notify the subscribed observer passing the structure modified by the current node
	 *
	 * @param data - The structure to be passed to the notified observers
	 */
	protected notify(data: Structure): void {
		for(const entry of this.observersList) entry.observer.call(entry.node, data);
	}

	/**
	 * Routine called when another node notifies the current one
	 *
	 * @param data - The structure received by the subscribed node
	 */
	notifier(data: Structure): void {
		void data;
		throw Error(`Notifier should not be called for "${this.name}"`);
	}

    /**
     * Save the node status
     *
     * @returns The JSON formatted status to be saved. If empty string, no status is saved
     */
	abstract saveStatus(): string | Promise<string>;

    /**
     * Load the node status retrieved from project file into this node
     */
	abstract loadStatus(params: CtrlParams | ViewerState): void;

	/**
	 * Return the info needed to build the client part of the node
	 */
	abstract getUiInfo(): UiInfo;

	/**
	 * Setup channels for the node to communicate with
	 * the control/ui part in the renderer
	 *
	 * @param id - ID of the node
	 * @param channels - Array of channels definitions
	 */
	protected setupChannels(id: string, channels: ChannelDefinition[]): void {
		for(const channel of channels) {
			const channelName = `${id}:${channel.name}`;
			ipcMain.removeHandler(channelName);

			switch(channel.type) {
				case "invoke":
					ipcMain.handle(channelName, (_event, params: CtrlParams) => channel.callback.call(this, params));
					break;
				case "invokeAsync":
					ipcMain.handle(channelName, async (_event, params: CtrlParams) => channel.callback.call(this, params));
					break;
				case "send":
					ipcMain.on(channelName, (_event, params: CtrlParams) => channel.callback.call(this, params));
					break;
			}
		}
	}
}
