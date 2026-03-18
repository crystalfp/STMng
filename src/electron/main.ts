/**
 * Entry point for the main process.
 * It parses the command line parameters and initializes all the channels
 * between main processes and client windows.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-09
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
import {app, BrowserWindow, screen as electronScreen} from "electron";
import log from "electron-log";
import {Command, Option} from "commander";
import {version, description} from "../../package.json" with {type: "json"};
import {setupTitlebar} from "custom-electron-titlebar/main";
import {setupChannelPreferences, setMainTheme, setAntialiasing} from "./modules/Preferences";
import {createMainWindow, setupChannelSnapshot} from "./modules/WindowsUtilities";
import {disableSaveProjectEntry, setupChannelMenu} from "./modules/SystemMenu";
import {setupChannelVersions} from "./modules/Versions";
import {setupChannelFileSelector} from "./modules/SelectFile";
import {pm, setupChannelProject} from "./modules/ProjectManager";
import {setupChannelLogFile} from "./modules/AccessLog";
import {setupChannelSpecialSwitches} from "./modules/SpecialSwitches";
import type {CtrlParams} from "@/types";

// > Command line parsing
const program = new Command("STMng");
program
    .version(version)
    .description(description)
    .addOption(new Option("-t, --theme <theme>", "user interface theme").choices(["dark", "light"]))
    .option("-d, --default", "force load of default project")
	.option("-v, --verbose", "verbose")
	.option("-n, --no-antialiasing", "disable antialiasing (for performance)")
	.option("-e, --enable", "enable developer tools in production build")
	.option("-x, --extra <switches>", "extra command line switches")
	.option("-r, --read <file>", "input file to be read")
	.option("-a, --aux <file>", "auxiliary file to be read")
    .argument("[project-file]", "project file to be loaded");

if(import.meta.env.DEV) program.option("--no-sandbox", "forced during development");
program.parse(process.argv, {from: "electron"});

/**
 * Data passed on the command line
 * @notExported
 */
interface ProgramOptions {
    /** Theme for the application */
    theme?: "dark" | "light";
    /** Load the default project */
    default?: boolean;
    /** Verbose messages (for now do nothing) */
    verbose?: boolean;
    /** Enable developer tools on the production build */
    enable?: boolean;
    /** Extra command line switches */
    extra?: string;
    /** Enable antialiasing (the command line switch disables it) */
    antialiasing: boolean;
    /** Input file to be read */
    read?: string;
    /** Auxiliary file to be read */
    aux?: string;
}
const options = program.opts<ProgramOptions>();

// Verbose can be set also with the "STM_NG_VERBOSE"
// environment variable set to any value
const verbose = options.verbose ?? process.env.STM_NG_VERBOSE !== undefined;

// Tools can be enabled in production also with the "STM_NG_ENABLE"
// environment variable set to any value
const enable = options.enable ?? process.env.STM_NG_ENABLE !== undefined;
const isDevelopment = import.meta.env.DEV || enable;

// Enable or disable antialiasing
setAntialiasing(options.antialiasing);

// If present save paths of input files
const specialSwitches: CtrlParams = {
    inputFile: options.read ?? "",
    auxFile: options.aux ?? ""
};
if(specialSwitches.auxFile && !specialSwitches.inputFile) {
    specialSwitches.auxFile = "";
}

// > Setup the main process
// Initialize the logger
log.initialize();
log.transports.console.level = verbose ? "silly" : "warn";
log.transports.console.useStyles = true;
log.transports.file.level = verbose ? "silly" : "warn";
log.errorHandler.startCatching({showDialog: false});
log.eventLogger.startLogging();

// Handle uncaught errors
process.on("uncaughtException", (event): void => {
    log.error(`%cUnhandled exception: %c${event.message}\n`,
              "color: red", "color: unset", event.stack);
});

process.on("unhandledRejection", (event: PromiseRejectionEvent): void => {
    if(event.reason) log.error("%cUnhandled rejection:",
                               "color: red", event.reason);
});

// Initialize the channels between main process and client
setupChannelPreferences();
setupChannelVersions(version);
setupChannelFileSelector();
setupChannelProject();
setupChannelLogFile();
setupChannelMenu(isDevelopment);
setupChannelSpecialSwitches(specialSwitches);
setupChannelSnapshot();

// Initialize the theme to use
if(!options.theme) setMainTheme("dark");
else if(options.theme === "dark" || options.theme === "light") setMainTheme(options.theme, true);
else setMainTheme("dark", true);

// Setup the titlebar main process
setupTitlebar();

// If present, set extra command line switches
if(options.extra) {

    const switches = options.extra.split(/, */);
    for(const sw of switches) {
        if(sw.includes("=")) {
            const element = sw.split("=");
            if(element.length > 2) {

                app.commandLine.appendSwitch(element[0], `${element[1]}=${element[2]}`);
            }
            else app.commandLine.appendSwitch(element[0], element[1]);
        }
        else {
            app.commandLine.appendSwitch(sw);
        }
    }
}

// > Start application
app.whenReady().then(() => {

    // Create an initial window that fills the screen's available work area.
    const {width, height} = electronScreen.getPrimaryDisplay().workAreaSize;

    createMainWindow(width, height, isDevelopment);

    app.on("activate", () => {
        if(BrowserWindow.getAllWindows().length === 0) createMainWindow(width, height, isDevelopment);
    });

    // Load project
    if(options.default) {
        // Load default project
        pm.loadRememberedProject(true);
        disableSaveProjectEntry(true);
    }
    else if(program.args.length > 0) {
        pm.loadProjectAndRemember(program.args[0]);
        disableSaveProjectEntry(false);
    }
    else {
        const loadedDefaultProject = pm.loadRememberedProject(false);
        disableSaveProjectEntry(loadedDefaultProject);
    }
})
.catch((error: Error) => {
    log.error(`Cannot create main window. Error ${error.message}`);
    app.quit();
});

// > Close application
app.on("window-all-closed", () => {
    if(process.platform !== "darwin") app.quit();
});

// Hot reload preload scripts
process.on("message", (message) => {
    if(message === "electron-vite&type=hot-reload") {
        for(const win of BrowserWindow.getAllWindows()) {
            win.webContents.reload();
        }
    }
});
