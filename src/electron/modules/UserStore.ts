/**
 * General storage for preferences
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {app} from "electron";
import path from "node:path";
import fs from "fs-extra";
import yaml from "js-yaml";

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
			fs.ensureDirSync(userDataDir);
			this.filePath = path.join(userDataDir, filename);
		}

		if(fs.existsSync(this.filePath)) {
			this.data = yaml.load(fs.readFileSync(this.filePath, "utf8"),
								  {schema: yaml.CORE_SCHEMA}) as T;
		}
		else if(options?.defaultContent) {
			this.data = structuredClone(options.defaultContent) as T;
			fs.writeFileSync(this.filePath,
							 yaml.dump(this.data, {
								schema: yaml.CORE_SCHEMA,
								lineWidth: 256,
								flowLevel: 1
							 }), "utf8");
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
		fs.writeFileSync(this.filePath,
						 yaml.dump(this.data, {
							schema: yaml.CORE_SCHEMA,
							lineWidth: 256,
							flowLevel: 1
						 }), "utf8");
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
		fs.writeFileSync(this.filePath,
						 yaml.dump(this.data, {
							schema: yaml.CORE_SCHEMA,
							lineWidth: 256,
							flowLevel: 1
						 }), "utf8");
	}
}
