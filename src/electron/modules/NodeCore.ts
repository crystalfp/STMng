/**
 * Base class for all nodes.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {ipcMain} from "electron";
import type {Structure, CtrlParams, Viewer3DState, ChannelDefinition} from "@/types";

/**
 * Observer routine provided by another node
 * @notExported
 */
type Observer = (data: Structure) => void;

/** Base class for all application nodes */
export abstract class NodeCore {

	/** List of observers from subscribe() to this node */
	private readonly observersList: Observer[] = [];
	/** ID of the node */
	protected readonly id: string;

	/**
	 * Create a node
	 *
	 * @param id - ID of the created node
	 */
	constructor(id: string) {

		this.id = id;
	}

	/**
	 * Add an observer to the current node
	 *
	 * @param observer - The observer routine already bound to its node
	 */
	subscribe(observer: Observer): void {

		this.observersList.push(observer);
	}

	/**
	 * Notify the subscribed observer passing the structure modified by the current node
	 *
	 * @param data - The chemical structure to be passed to the notified observers
	 */
	protected toNextNode(data: Structure): void {

		for(const observer of this.observersList) observer(data);
	}

	/**
	 * Routine called when another node notifies the current one
	 *
	 * @param data - The structure received by the subscribed node
	 * @throws Error.
	 * If the node calls fromPreviousNode without overriding it
	 */
	fromPreviousNode(data: Structure): void {
		void data;
		throw Error("Notifier should not be called for this node");
	}

    /**
     * Save the node status
     *
     * @returns The JSON formatted status to be saved. If empty string, no status is saved
     */
	abstract saveStatus(): string | Promise<string>;

    /**
     * Load the node status retrieved from project file into this node
	 *
	 * @param params - The parameters from the project file
	 */
	abstract loadStatus(params: CtrlParams | Viewer3DState): void;

	/**
	 * Setup channels for the node to communicate with
	 * the control/ui part in the renderer
	 *
	 * @remarks The channel callbacks should have `.bind(this)`
	 *
	 * @param id - ID of the node
	 * @param channels - Array of channels definitions
	 */
	protected setupChannels(id: string, channels: ChannelDefinition[]): void {

		for(const channel of channels) {
			const channelName = id + ":" + channel.name;
			ipcMain.removeHandler(channelName);

			switch(channel.type) {
				case "invoke":
					ipcMain.handle(channelName, (_event, params: CtrlParams) => channel.callback(params));
					break;
				case "invokeAsync":
					ipcMain.handle(channelName, async (_event, params: CtrlParams) => channel.callback(params));
					break;
				case "send":
					ipcMain.on(channelName, (_event, params: CtrlParams) => channel.callback(params));
					break;
			}
		}
	}
}
