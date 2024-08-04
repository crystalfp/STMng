/**
 * Entry point for the main process.
 * It parse command line parameters and initializes all the channels between main processes and client windows.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import {app, BrowserWindow, screen as electronScreen} from "electron";
import log from "electron-log";
import {Command, Option} from "commander";
import pkg from "../../package.json";

import {setupTitlebar} from "custom-electron-titlebar/main";
import {setupChannelPreferences, setMainTheme} from "./modules/Preferences";
import {createMainWindow} from "../../old/electron/modules/WindowsUtilities";
import {disableSaveProjectEntry} from "./modules/SystemMenu";
import {setupChannelVersions} from "./modules/Versions";
import {setupChannelCapture} from "../../old/electron/modules/CaptureMedia";
import {setupChannelSymmetries} from "../../old/electron/modules/Symmetries";
import {setupChannelWriter} from "../../old/electron/modules/Writer";
import {setupChannelFingerprints} from "../../old/electron/modules/Fingerprints";
import {setupChannelAtomData} from "./modules/AtomData";
import {pm} from "./modules/ProjectManager";

// > Command line parsing
const program = new Command("STMng");
program
    .version(pkg.version)
    .description(pkg.description)
    .usage("[options] [project-file]")
    .addOption(new Option("-t, --theme <theme>", "user interface theme").choices(["dark", "light"]))
    .option("-d, --default", "force load of default project")
	.option("-v, --verbose", "verbose")
    .addHelpText("before", " ")
    .addHelpText("after", " ");

if(import.meta.env.DEV) program.option("--no-sandbox", "forced during development");
program.parse(process.argv, {from: "electron"});

interface ProgramOptions {
    theme?: "dark" | "light";
    default?: boolean;
    verbose?: boolean;
}
const options = program.opts<ProgramOptions>();

// Verbose can be set also with the "STM_NG_VERBOSE" environment variable set to any value
const verbose = options.verbose || process.env.STM_NG_VERBOSE !== undefined;

// > Setup the main process
// Initialize the logger
log.initialize();
log.transports.console.level = verbose ? "silly" : "warn";
log.transports.file.level = verbose ? "silly" : "warn";
log.errorHandler.startCatching({showDialog: false});
log.eventLogger.startLogging();

// Handle uncaught errors
process.on("uncaughtException", (event) => {
	log.error("Unhandled exception:", event.message);
});

process.on("unhandledRejection", (event: PromiseRejectionEvent) => {
	log.error("Unhandled rejection:", event.reason);
});

// Initialize the channels between main process and client
setupChannelPreferences();
setupChannelVersions();
setupChannelCapture();
setupChannelSymmetries();
setupChannelWriter();
setupChannelFingerprints();
setupChannelAtomData();

// Initialize the theme to use
if(!options.theme) setMainTheme("dark");
else if(options.theme === "dark" || options.theme === "light") setMainTheme(options.theme, true);
else setMainTheme("dark", true);

// Setup the titlebar main process
setupTitlebar();

// > Start application
app.whenReady().then(() => {

    // Create an initial window that fills the screen's available work area.
    const {width, height} = electronScreen.getPrimaryDisplay().workAreaSize;

    createMainWindow(width, height);

    app.on("activate", () => {
        if(BrowserWindow.getAllWindows().length === 0) createMainWindow(width, height);
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
