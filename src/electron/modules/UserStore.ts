/**
 * General storage for preferences.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
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
import {app} from "electron";
import path from "node:path";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";

/**
 * Per user storage
 */
export class Store {

	private readonly data = new Map<string, string>();
	private readonly filePath: string;

	/**
	 * Create the store and associate the requested file
	 *
	 * @param name - Name of the store
	 */
	constructor(name: string) {

		const directory = app.getPath("userData");
		const userDataDir = path.join(directory, "UserData");
		if(!existsSync(userDataDir)) {
			mkdirSync(userDataDir, {recursive: true});
		}
		const filename = `${name}.yaml`;
		this.filePath = path.join(userDataDir, filename);

		if(existsSync(this.filePath)) this.load();
	}

	/**
	 * Deserialize the saved store content
	 */
	private load(): void {

		const content = readFileSync(this.filePath, "utf8");

		const lines = content.replaceAll("\r\n", "\n").split("\n");

		this.data.clear();
		for(const line of lines) {

			const fields = line.split(/: +/);
			if(fields.length < 2) continue;
			this.data.set(fields[0], fields[1]);
		}
	}

	/**
	 * Serialize the store content and save it
	 */
	private save(): void {

		let out = "";
		for(const [key, value] of this.data.entries()) {
			out += `${key}: ${value}\n`;
		}
		writeFileSync(this.filePath, out, "utf8");
	}

	/**
	 * Retrieve string content for the given key
	 *
	 * @param key - Key of the value to retrieve
	 * @param defaultValue - Default value for the retrieved value
	 * @returns The retrieved value
	 */
	getString(key: string, defaultValue?: string): string {

		if(this.data.has(key)) {
			return this.data.get(key)!;
		}
		if(defaultValue !== undefined) {
			this.data.set(key, defaultValue);
			this.save();
			return defaultValue;
		}
		return "";
	}

	/**
	 * Set string content for the given key
	 *
	 * @param key - Key to set
	 * @param value - Value to be set on the key
	 */
	setString(key: string, value: string): void {

		if(this.data.get(key) === value) return;

		this.data.set(key, value);
		this.save();
	}

	/**
	 * Set integer content for a set of keys
	 *
	 * @param keys - Keys of the values to retrieve
	 * @param defaultValues - Default values for the retrieved keys
	 * @returns The retrieved values
	 */
	getIntegers(keys: string[], defaultValues?: number[]): number[] {

		let needsSave = false;
		const results: number[] = [];
		for(let i = 0; i < keys.length; i++) {
			if(this.data.has(keys[i])) {
				results.push(Number.parseInt(this.data.get(keys[i])!, 10));
			}
			else if(defaultValues === undefined) {
				results.push(0);
			}
			else {
				this.data.set(keys[i], defaultValues[i].toFixed(0));
				results.push(defaultValues[i]);
				needsSave = true;
			}
		}
		if(needsSave) this.save();
		return results;
	}

	/**
	 * Set integer content for a set of keys
	 *
	 * @param keys - Keys to set
	 * @param values - Values to be set on the keys
	 */
	setIntegers(keys: string[], values: number[]): void {

		let needsSave = false;
		const stringValues: string[] = [];
		for(let i = 0; i < keys.length; i++) {
			const s = values[i].toFixed(0);
			stringValues.push(s);
			if(this.data.get(keys[i]) !== s) needsSave = true;
		}
		if(needsSave) {
			for(let i = 0; i < keys.length; i++) {
				this.data.set(keys[i], stringValues[i]);
			}
			this.save();
		}
	}

	/**
	 * Retrieve boolean value for the given key
	 *
	 * @param key - Key of the value to retrieve
	 * @param defaultValue - Default value for the retrieved key
	 * @returns The retrieved value
	 */
	getBoolean(key: string, defaultValue?: boolean): boolean {

		if(this.data.has(key)) {
			const status = this.data.get(key);
			return status === "yes";
		}
		if(defaultValue !== undefined) {

			this.data.set(key, defaultValue ? "yes" : "no");
			this.save();
			return defaultValue;
		}
		return false;
	}

	/**
	 * Set boolean value for the given key
	 * The boolean value is saved as "yes" or "no" strings
	 *
	 * @param key - Key to set
	 * @param value - Boolean value to be set on the key
	 */
	setBoolean(key: string, value: boolean): void {

		const updatedValue = value ? "yes" : "no";
		if(this.data.get(key) === updatedValue) return;

		this.data.set(key, updatedValue);
		this.save();
	}

	/**
	 * Check if the key exists in the store
	 *
	 * @param key - The key to check
	 * @returns True if the key exists in the store
	 */
	has(key: string): boolean {
		return this.data.has(key);
	}

	/**
	 * Delete a key from the store
	 *
	 * @param key - Key to delete
	 */
	delete(key: string): void {

		this.data.delete(key);
		this.save();
	}
}
