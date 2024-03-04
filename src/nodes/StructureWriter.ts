/**
 * Write structures to file.
 *
 * @packageDocumentation
 */
import {sb, type UiParams} from "@/services/Switchboard";
import {selectSaveStructureFile, saveStructureFile} from "@/services/RoutesClient";
import {showErrorNotification, resetErrorNotification} from "@/services/ErrorNotification";
import type {Structure} from "@/types";

export class StructureWriter {

	private format = "";
	private selectFile = false;
	private inProgress = false;
	private inProgressContinuous = false;
	private continuous = false;
	private readonly encodedStructures: string[] = [];
	private structure: Structure | undefined;
	private outFilename = "";

	/**
	 * Create the node
	 *
	 * @param id - ID of the Structure Writer node
	 */
	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {

			this.format = params.format as string ?? "";
			this.selectFile = params.selectFile as boolean ?? false;
			this.inProgress = params.inProgress as boolean ?? false;
			this.continuous = params.continuous as boolean ?? false;

			if(this.selectFile) {

				resetErrorNotification("structureWriter");

				selectSaveStructureFile(this.format)
					.then((filename) => {

						this.selectFile = false;
						this.outFilename = filename;
						if(filename === "") {
							sb.setUiParams(this.id, {
								selectFile: false,
								outputFile: ""
							});
						}
						else {
							const pos = filename.lastIndexOf("/");
							const basename = filename.slice(pos+1);
							sb.setUiParams(this.id, {
								selectFile: false,
								outputFile: basename
							});
						}
					})
					.catch((error: Error) => {
						showErrorNotification(`Error selecting structure: ${error.message}`,
											  "structureWriter");
					});
			}

			if(this.inProgress) {
				if(this.continuous) {
					// Start Continuous
					this.inProgressContinuous = true;

					this.encodedStructures.length = 0;
					this.encodedStructures.push(JSON.stringify(this.structure));
				}
				else {
					// Single structure capture
					const structures = JSON.stringify([this.structure]);
					saveStructureFile(this.format, this.outFilename, structures)
						.then((stat) => {
							this.inProgress = false;
							if(stat.error) throw Error(stat.error);
							sb.setUiParams(this.id, {
								inProgress: false
							});
						})
						.catch((error: Error) => {
							this.inProgress = false;
							sb.setUiParams(this.id, {
								inProgress: false
							});
							showErrorNotification(`Error writing structure: ${error.message}`,
											  	  "structureWriter");
						});
				}
			}
			else if(this.inProgressContinuous) {

				// End continuous capture
				this.inProgressContinuous = false;

				const structures = `[${this.encodedStructures.join(",")}]`;
				saveStructureFile(this.format, this.outFilename, structures)
					.then((stat) => {
						this.inProgress = false;
						if(stat.error) throw Error(stat.error);
						sb.setUiParams(this.id, {
							inProgress: false
						});
					})
					.catch((error: Error) => {
						this.inProgress = false;
						sb.setUiParams(this.id, {
							inProgress: false
						});
						showErrorNotification(`Error writing structure: ${error.message}`,
											  "structureWriter");
					});

			}
		});

		sb.getData(this.id, (data: unknown) => {

			this.structure = data as Structure;
			if(!this.structure) return;

			// If in continuous capture mode save the structure encoded
			if(this.inProgressContinuous) {
				this.encodedStructures.push(JSON.stringify(this.structure));
			}
		});
	}

	/**
	 * Save the node status
	 *
	 * @returns The JSON formatted status to be saved
	 */
	saveStatus(): string {

		const statusToSave = {
			format: this.format,
			continuous: this.continuous
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
