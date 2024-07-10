/**
 * Entry point for the main process.
 * It parse command line parameters and initializes all the channels between main processes and client windows.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import {app, BrowserWindow, screen as electronScreen} from "electron";
import log from "electron-log";
import {Command, Option} from "commander";
import pkg from "../../package.json";

import {setupTitlebar} from "custom-electron-titlebar/main";
import {setupChannelPreferences, setMainTheme} from "./modules/Preferences";
import {loadRememberedProject, loadProjectAndRemember, setupChannelProject} from "./modules/Project";
import {createMainWindow} from "./modules/WindowsUtilities";
import {disableSaveProjectEntry} from "./modules/SystemMenu";
import {setupChannelVersions} from "./modules/Versions";
import {setupChannelReader} from "./modules/Reader";
import {setupChannelCapture} from "./modules/CaptureMedia";
import {setupChannelSymmetries} from "./modules/Symmetries";
import {setupChannelWriter} from "./modules/Writer";
import {setupChannelFingerprints} from "./modules/Fingerprints";
import {setupChannelAtomData} from "./modules/AtomData";

// TEST
import {pm} from "../../new/electron/modules/ProjectManager";

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

// > Setup the main process
// Initialize the logger
log.initialize();
log.transports.console.level = options.verbose ? "silly" : "warn";
log.transports.file.level = options.verbose ? "silly" : "warn";
log.errorHandler.startCatching({showDialog: false});
log.eventLogger.startLogging();

// Initialize the channels between main process and client
setupChannelPreferences();
setupChannelVersions();
setupChannelProject();
setupChannelReader();
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
        loadRememberedProject(true);
        pm.loadRememberedProject(true);
        disableSaveProjectEntry(true);
    }
    else if(program.args.length > 0) {
        loadProjectAndRemember(program.args[0]);
        pm.loadProjectAndRemember(program.args[0]);
        disableSaveProjectEntry(false);
    }
    else {
        const loadedDefaultProject = loadRememberedProject(false);
        pm.loadRememberedProject(false);

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
