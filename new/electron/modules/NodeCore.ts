/**
 * Base class for all nodes.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @file NodeCore.ts
 * @since Fri Jul 05 2024
 */
import type {Structure, UiInfo, UiParams, ViewerState} from "../../types";

type Observer = (data: Structure) => void;

interface ObserverEntry {
	observer: Observer;
	node: NodeCore;
}

export abstract class NodeCore {

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
	 * The computation of this node
	 * @remarks Verify if makes sense to have it exposed
	 */
	abstract run(): void;

	/**
	 * Routine called when another node notifies the current one
	 *
	 * @param data - The structure received by the subscribed node
	 */
	abstract notifier(data: Structure): void;

    /**
     * Save the node status
     *
     * @returns The JSON formatted status to be saved
     */
	abstract saveStatus(): string;

    /**
     * Load the node status
     */
	abstract loadStatus(params: UiParams | ViewerState): void;

	/**
	 * Return the info needed to build the client part of the node
	 */
	abstract getUiInfo(): UiInfo;
}
