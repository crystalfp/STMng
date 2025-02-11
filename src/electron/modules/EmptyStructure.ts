/**
 * Provides an empty structure
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-09-24
 */
import type {Structure, Crystal, Atom, Bond, Volume, Extra} from "@/types";

export class EmptyStructure implements Structure {

	public crystal: Crystal = {
		basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
		origin: [0, 0, 0],
		spaceGroup: ""
	};

	public atoms: Atom[] = [];
	public bonds: Bond[] = [];
	public volume: Volume[] = [];
	public extra: Extra = {id: 1};
}
