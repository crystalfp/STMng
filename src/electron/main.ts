/**
 * Entry point for the main process.
 * It initializes all the channels between main processes and client windows.
 *
 * @packageDocumentation
 */
import {app, BrowserWindow, screen as electronScreen} from "electron";
import log from "electron-log";
// eslint-disable-next-line @typescript-eslint/no-shadow
import {Command, Option} from "commander";
import pck from "../../package.json";

import {setupTitlebar} from "custom-electron-titlebar/main";
// import installExtension, {VUEJS_DEVTOOLS} from "electron-devtools-installer";
import {setupChannelPreferences, setMainTheme} from "./modules/Preferences";
import {loadProject, setupChannelProject} from "./modules/Project";
import {createMainWindow} from "./modules/WindowsUtilities";
import {setupChannelVersions} from "./modules/Versions";
import {setupChannelReader} from "./modules/Reader";

// > Setup main process
// Initialize the logger
log.initialize();
const verbose = app.commandLine.hasSwitch("verbose") ||
                (process.env.IIE_VERBOSE && Number.parseInt(process.env.IIE_VERBOSE) > 0);
log.transports.console.level = verbose ? "silly" : "warn";
log.transports.file.level = verbose ? "silly" : "warn";
log.errorHandler.startCatching({showDialog: false});
log.eventLogger.startLogging();

// Initialize the channels
setupChannelPreferences();
setupChannelVersions();
setupChannelProject();
setupChannelReader();

// Command line parsing
const program = new Command("STMng");
program
    .version(pck.version)
    .description(pck.description)
    .usage("[options]")
    .addOption(new Option("-t, --theme <theme>", "User interface theme").choices(["dark", "light"]))
    .addHelpText("before", " ")
    .addHelpText("after", " ");

if(import.meta.env.DEV) program.option("--no-sandbox", "Forced during development");
program.parse(process.argv, {from: "electron"});

interface ProgramOptions {
    theme?: "dark" | "light";
}
const options = program.opts<ProgramOptions>();

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
    if(program.args.length > 0) loadProject(program.args[0]);
    else loadProject();

    // if(import.meta.env.DEV) return installExtension(VUEJS_DEVTOOLS);
    // return "";
})
// .then((extensionName) => {if(extensionName) log.info(`Added Extension: ${extensionName}`);})
.catch((error: Error) => {
    log.error(`Cannot create main window. Error ${error.message}`);
    app.quit();
});

// > Close application
app.on("window-all-closed", () => {
    if(process.platform !== "darwin") app.quit();
});
