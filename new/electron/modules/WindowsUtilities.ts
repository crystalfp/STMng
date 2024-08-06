/**
 * Creating/closing windows and setup communications to them
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import {app, BrowserWindow, nativeImage, ipcMain /* dialog */} from "electron";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {attachTitlebarToWindow} from "custom-electron-titlebar/main";
import log from "electron-log";
import {setupMenu} from "./SystemMenu";
import {setupRelayToMainWin, setupRelayFromMainWin} from "../../../old/electron/modules/RelayForMainWin";
import favicon from "../../../new/assets/favicon.png";
import type {WindowsParams} from "../../../old/electron/types";
import type {ClientProjectInfo, CtrlParams, StructureRenderInfo} from "../../types";

/** List of opened windows, main and secondary ones */
const openedWindows = new Map<string, BrowserWindow>();

/** The main window */
let mainWin: BrowserWindow;

/** Access needed directories */
const {VITE_DEV_SERVER_URL} = process.env;
const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(mainSourceDirectory, "..", "dist");

// > Create the main application window
/**
 * Create the main application window
 *
 * @param width - Default width of the main window
 * @param height - Default height of the main window
 */
export const createMainWindow = (width = 1000, height = 675): void => {

    mainWin = new BrowserWindow({
        webPreferences: {
            preload: path.join(mainSourceDirectory, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            defaultFontSize: 18,
            devTools: true
        },
        title: "Application is currently initializing...",
        titleBarStyle: "hidden",
        titleBarOverlay: false,
        width,
        height,
        show: false,
        backgroundColor: "#272822",
        center: true,
        autoHideMenuBar: true,
        icon: nativeImage.createFromDataURL(favicon),
    });
    if(!mainWin) {
        log.error("Cannot create main window. Quit");
        app.quit();
    }

    // Attach fullscreen(f11 and not 'maximized') && focus listeners
    attachTitlebarToWindow(mainWin);

    // Open main window full screen (use show() to have a normal window for testing)
    mainWin.once("ready-to-show", () => {

        mainWin.maximize();

        // Setup relay between windows
        setupRelayToMainWin(mainWin);
        setupRelayFromMainWin();
    });

    if(VITE_DEV_SERVER_URL) {
        void mainWin.loadURL(VITE_DEV_SERVER_URL);
    }
    else {
        void mainWin.loadFile(path.join(DIST, "index.html"));
    }

    // Send full screen changes to main window to adjust vertical size of layout
    mainWin.on("enter-full-screen", () => {
        mainWin.webContents.mainFrame.send("WINDOW:FULLSCREEN", true);
    });
    mainWin.on("leave-full-screen", () => {
        mainWin.webContents.mainFrame.send("WINDOW:FULLSCREEN", false);
    });
    mainWin.webContents.on("unresponsive", () => {
        log.error("Main window unresponsive");
    });

    // To avoid garbage collection problems
    openedWindows.set("/", mainWin);

    // Functions to manage a secondary window
    ipcMain.on("WINDOW:NEW", createSecondaryWindow);
    ipcMain.on("WINDOW:CLOSE", closeSecondaryWindow);
    ipcMain.handle("WINDOW:CHECK", isSecondaryWindowOpen);
    ipcMain.on("WINDOW:SEND", sendToSecondaryWindow);

    // Setup the system menu
    setupMenu();
};

// > Create a secondary window
/**
 * Create a secondary window
 *
 * @param _event - Ignored IPC event
 * @param params - Params for the created window
 */
export const createSecondaryWindow = (_event: unknown, params: WindowsParams): void => {

    // If already created do nothing
    if(openedWindows.has(params.routerPath)) return;

    // Create the window and remove the system menu
    const secondaryWin = new BrowserWindow({
        width: params.width,
        height: params.height,
        icon: nativeImage.createFromDataURL(favicon),
        autoHideMenuBar: true,
		title: params.title,
		show: false,
        backgroundColor: "#272822",
        webPreferences: {
            preload: path.join(path.dirname(fileURLToPath(import.meta.url)), "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            defaultFontSize: 18,
            devTools: import.meta.env.DEV
        }
    });
    if(!secondaryWin) {
        sendErrorNotification("Cannot create secondary window");
        return;
    }
    secondaryWin.removeMenu();

    // Load the content and show it
    if(VITE_DEV_SERVER_URL) {
        void secondaryWin.loadURL(`${VITE_DEV_SERVER_URL}#${params.routerPath}`);
    }
    else {
        void secondaryWin.loadURL(`file://${mainSourceDirectory}/../dist/index.html#${params.routerPath}`);
    }
    secondaryWin.once("ready-to-show", () => {
        secondaryWin!.show();
    });
    if(params.data) secondaryWin.once("show", () => {
        secondaryWin.webContents.send("APP:DATA", params.data);
    });

    // Manage the list of opened windows
    openedWindows.set(params.routerPath, secondaryWin);
    secondaryWin.on("close", (/* evt */) => {
        // TBD Intercept closure from [X] button
        // evt.preventDefault();

        // const choice = dialog.showMessageBox(secondaryWin, {
        //     type: "question",
        //     buttons: ["Yes", "No"],
        //     title: "Confirm",
        //     message: "Are you sure you want to quit?"
        // });

        // void choice.then((response) => {

        //     if(response.response === 0) {

        //         openedWindows.delete(params.routerPath);
        //         secondaryWin.destroy();
        //     }
        // });
        openedWindows.delete(params.routerPath);
    });
};

// > Close the secondary window
/**
 * Close the secondary window
 *
 * @param _event - Ignored IPC event
 * @param routerPath - The router path of the created window
 */
const closeSecondaryWindow = (_event: unknown, routerPath: string): void => {

    const win = openedWindows.get(routerPath);
    if(!win) return;

    win.close();
    openedWindows.delete(routerPath);
};

// > Check if a secondary window is on screen
/**
 * Check if a secondary window is open
 *
 * @param _event - Ignored IPC event
 * @param routerPath - The router path of the created window to check
 * @returns True if the window is open
 */
export const isSecondaryWindowOpen = (_event: unknown, routerPath: string): boolean => openedWindows.has(routerPath);

// > Send data to a secondary window
/**
 * Send data to a secondary window
 *
 * @param _event - Ignored IPC event
 * @param payload - Destination window and the data to send to it
 */
export const sendToSecondaryWindow = (_event: unknown,
                                      payload: {routerPath: string; data: string}): void => {

    const win = openedWindows.get(payload.routerPath);
    if(win) win.webContents.send("APP:DATA", payload.data);
};

// > Broadcast message
/**
 * Broadcast message to all open windows
 *
 * @param eventType - Identifier of the message
 * @param params - The data to broadcast
 */
export const broadcastMessage = (eventType: string, ...params: (boolean | string)[]): void => {

    for(const win of openedWindows) {
        win[1].webContents.send("APP:BROADCAST", {eventType, eventData: [...params]});
    }
};

// > Show developer tools on each secondary window open
/**
 * Show developer tools on each secondary window open
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
export const showDevToolsOnSecondaryWindows = (): void => {

    for(const win of openedWindows) {
        if(win[0] === "/") continue;
        win[1].webContents.closeDevTools();
        win[1].webContents.openDevTools();
    }
};

// > Open the given system menu entry
/**
 * Open the given system menu entry on the main window
 *
 * @param entryName - Label to identify the menu entry activated on the main window
 * @param payload - Optional data to be sent to the main window. If missing it is an empty string
 */
export const openMenuEntry = (entryName: string, payload=""): void => {

    mainWin.webContents.send("APP:MENU", entryName, payload);
};

// > Update the main window project
/**
 * Update the main window project
 *
 * @param projectAsString - JSON encoded project to update the main window project
 */
export const sendLoadedProject = (projectAsString: string): void => {

    mainWin.webContents.send("PROJECT:GET-NEXT", projectAsString);
};

/**
 * Get the current loaded project with its parameters for save.
 *
 * @returns The current loaded project as JSON formatted string
 */
export const requestLoadedProject = (): Promise<string> => {

    mainWin.webContents.send("PROJECT:REQUEST");

    return new Promise((resolve) => {
        ipcMain.on("PROJECT:ANSWER", (_event: unknown, answer: string): void => resolve(answer));
    });
};

/**
 * Send the current project path to main window to put it in the title.
 *
 * @param projectPath - The project file path or an empty string for the default project
 */
export const sendProjectPath = (projectPath?: string): void => {

    mainWin.webContents.send("PROJECT:PATH", projectPath ? path.basename(projectPath) : "");
};

/**
 * Send error notification from main process
 *
 * @param text - Text of the notification
 */
export const sendErrorNotification = (text: string): void => {

    mainWin.webContents.send("APP:NOTIFICATION", "error", text);
};

/**
 * Request a system menu refresh in the client process
 */
export const refreshSystemMenu = (): void => {

    mainWin.webContents.send("APP:REFRESH-MENU");
};

/**
 * Get the type of the current node
 *
 * @returns The type of the current node open in the UI
 */
export const getCurrentNode = (): Promise<string> => {

    mainWin.webContents.send("PROJECT:ASK-CURRENT-NODE");

    return new Promise((resolve) => {
        ipcMain.on("PROJECT:GET-CURRENT-NODE", (_event: unknown, answer: string): void => resolve(answer));
    });
};

// TEST Routines for the new architecture
let firstSendProjectUI = true;
/**
 * Update the main window project
 *
 * @param clientProjectInfo - Project info to be passes to the client to setup UI etc.
 */
export const sendProjectUI = (clientProjectInfo: ClientProjectInfo): void => {

    if(firstSendProjectUI) {
        ipcMain.handle("PROJECT:SEND:INFO-FIRST", () => {
            firstSendProjectUI = false;
            return clientProjectInfo;
        });
    }
    else mainWin.webContents.send("PROJECT:SEND:INFO-NEXT", clientProjectInfo);
};

/**
 * Send error notification from main process
 *
 * @param text - Text of the notification
 */
export const sendAlertMessage = (text: string): void => {

    mainWin.webContents.send("APP:NOTIFICATION", "error", text);
};

/**
 * Push data to the client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param params - Parameters to send to the client process
 */
export const sendToClient = (id: string, channel: string, params: CtrlParams): void => {

    mainWin.webContents.send(`${id}:${channel}`, params);
};

/**
 * Push structure data to the client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param params - Parameters to send to the client process
 */
export const sendToClientForRendering = (id: string,
                                         channel: string,
                                         renderInfo: StructureRenderInfo): void => {

    mainWin.webContents.send(`${id}:${channel}`, renderInfo);
};

/**
 * Ask the client to receive a string
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @returns The viewer3D state stringified
 */
export const askClient = (id: string, channel: string): Promise<string> => {

    mainWin.webContents.send(`${id}:${channel}`);
    return new Promise((resolve) => {
        ipcMain.on(`${id}:${channel}-res`, (_event: unknown, answer: string): void => resolve(answer));
    });
};

/**
 * Push structure data to the client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param vertices - Parameters to send to the client process
 */
export const sendVerticesToClient = (id: string, channel: string, vertices: number[]): void => {

    mainWin.webContents.send(`${id}:${channel}`, vertices);
};
