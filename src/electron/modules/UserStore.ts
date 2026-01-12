/**
 * General storage for preferences
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {app} from "electron";
import path from "node:path";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import YAML from "yaml";

/**
 * Store parameters
 * @notExported
 */
interface StoreOptions {
	/** Path to the store backing file.
	    If present should have an extension of .yaml
		else the backing store will be under userData */
	path?: string;

	/** Name of the store. If absent defaults to "config" */
	name?: string;

	/** Default initial content of the store */
	defaultContent?: unknown;
}

/**
 * Per user storage.
 * @remarks The storage type should be a Type, not an Interface.
 *
 * @typeParam T - The type of the store
 */
export class Store<T extends Record<string, string | string[] | number | boolean | Record<string, string>>> {

	private data: T;
	private readonly filePath: string;

	/**
	 * Create the store and associate the requested file
	 *
	 * @param options - Options to build the store
	 */
	constructor(options?: StoreOptions) {

		if(options?.path) {
			this.filePath = options.path;
		}
		else {
			const filename = `${options?.name ?? "config"}.yaml`;
			const directory = app.getPath("userData");
			const userDataDir = path.join(directory, "UserData");
 			if(!existsSync(userDataDir)) {
    			mkdirSync(userDataDir, {recursive: true});
			}
			this.filePath = path.join(userDataDir, filename);
		}

		if(existsSync(this.filePath)) {
			this.data = Store.load(this.filePath) as T;
		}
		else if(options?.defaultContent) {
			this.data = structuredClone(options.defaultContent) as T;
			Store.save(this.filePath, this.data);
		}
		else this.data = {} as T;
	}

	/**
	 * Retrieve content for the given key
	 *
	 * @param key - Key of the value to retrieve
	 * @param defaultValue - default value for the retrieved value
	 * @returns The retrieved value
	 */
	get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K] {
		return this.data[key] ?? defaultValue;
	}

	/**
	 * Set store value for the given key
	 *
	 * @param key - Key to set
	 * @param value - Value to be set on the key
	 */
	set<K extends keyof T>(key: K, value: T[K]): void {
		this.data[key] = value;
		Store.save(this.filePath, this.data);
	}

	/**
	 * Set store boolean value for the given key
	 * The boolean value is saved as "yes" or "no" string
	 *
	 * @param key - Key to set
	 * @param value - Boolean value to be set on the key
	 */
	setBoolean(key: string, value: boolean): void {

		const s = value ? "yes" : "no";
		this.set(key, s as T[keyof T]);
	}

	/**
	 * Retrieve boolean value for the given key
	 *
	 * @param key - Key of the value to retrieve
	 * @param defaultValue - default value for the retrieved key
	 * @returns The retrieved value
	 */
	getBoolean(key: string, defaultValue: boolean): boolean {

		if(this.has(key)) {
			const status = this.get(key) as string;
			return status === "yes";
		}

		const s = defaultValue ? "yes" : "no";
		this.set(key, s as T[keyof T]);

		return defaultValue;
	}

	/**
	 * Check if the key exists in the store
	 *
	 * @param key - The key to check
	 * @returns True if the key exists in the store
	 */
	 // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
	has<K extends keyof T>(key: K): boolean {
		return this.data[key] !== undefined;
	}

	/**
	 * Delete a key from the store
	 *
	 * @param key - Key to be deleted
	 */
	 // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
	delete<K extends keyof T>(key: K): void {
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete this.data[key];
		Store.save(this.filePath, this.data);
	}

	/**
	 * Deserialize the saved store content
	 *
	 * @param file - File to be read
	 * @returns The parsed file content
	 */
	private static load(file: string): unknown {

		return YAML.parse(readFileSync(file, "utf8"));
	}

	private static save(file: string, data: unknown): void {

		writeFileSync(file, YAML.stringify(data, {lineWidth: 256}), "utf8");
	}
}
