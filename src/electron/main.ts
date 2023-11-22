/**
 * Entry point for the main process. It initializes all the channels between main processes and client windows.
 *
 * @packageDocumentation
 */
import {app, BrowserWindow, screen as electronScreen, protocol, net} from "electron";
import log from "electron-log";
import {setupTitlebar} from "custom-electron-titlebar/main";
// import installExtension, {VUEJS_DEVTOOLS} from "electron-devtools-installer";
import {setupChannelPreferences, setMainTheme} from "./modules/Preferences";
// import {setupChannelProjects} from "./modules/Projects";
// import {setupChannelTags} from "./modules/Tags";
import {createMainWindow} from "./modules/WindowsUtilities";
// import {setupChannelVersions} from "./modules/Versions";
// import {Database, setupChannelDatabase} from "./modules/Database";
// import {setupChannelExports} from "./modules/Exports";
// import {setupChannelKB} from "./modules/KB";
// import {ParseDocuments} from "./modules/ParseDocuments";
// import {setupChannelConfiguration} from "./modules/Configuration";
// import {ExtractKeywords} from "./modules/ExtractKeywords";
// import {setupChannelWorklist} from "./modules/Worklist";

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
// setupChannelDatabase(database, parsers);
setupChannelPreferences();
// setupChannelConfiguration();
// setupChannelProjects(database);
// setupChannelTags();
// setupChannelVersions();
// setupChannelExports(database, parsers);
// setupChannelKB(database, parsers);
// setupChannelWorklist();

// Initialize the theme to use
const theme = app.commandLine.getSwitchValue("theme");
if(!theme) {
    setMainTheme("dark");
}
else if(theme === "dark" || theme === "light") {
    setMainTheme(theme, true);
}
else {
    setMainTheme("dark", true);
}

// Setup the titlebar main process
setupTitlebar();

// > Start application
app.whenReady().then(() => {

    // Set local protocol to load images
    // The URL should contain the absolute path of the image
    protocol.handle("iie", (request) => {

        const updatedURL = request.url.slice("iie://".length).replace(/^([A-Z])\//, "$1:/");
        return net.fetch(`file://${updatedURL}`, {
            method: request.method,
            headers: request.headers,
            body: request.body
        });
    });

    // Create an initial window that fills the screen's available work area.
    const {width, height} = electronScreen.getPrimaryDisplay().workAreaSize;

    createMainWindow(width, height);

    app.on("activate", () => {
        if(BrowserWindow.getAllWindows().length === 0) createMainWindow(width, height);
    });

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
