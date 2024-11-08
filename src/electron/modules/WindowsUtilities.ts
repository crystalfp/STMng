/**
 * Creating/closing windows and setup communications to them
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {app, BrowserWindow, nativeImage, ipcMain} from "electron";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {attachTitlebarToWindow} from "custom-electron-titlebar/main";
import log from "electron-log";
import {setupMenu} from "./SystemMenu";
import favicon from "../../assets/favicon.png";
import type {ClientProjectInfo, CtrlParams, StructureRenderInfo, WindowsParams} from "@/types";

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
 * @param isDevelopment - If the developer tools should be shown on the main window
 */
export const createMainWindow = (width: number, height: number, isDevelopment: boolean): void => {

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
    setupMenu(isDevelopment);
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
        sendAlertMessage("Cannot create secondary window");
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
        secondaryWin?.show();
    });

    if(params.data) secondaryWin.once("show", () => {
        setTimeout(() => secondaryWin.webContents.send("SYSTEM:DATA", params.data), 200);
    });

    // Manage the list of opened windows
    openedWindows.set(params.routerPath, secondaryWin);
    secondaryWin.on("close", () => {
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

    let win = openedWindows.get(routerPath);
    if(!win) return;

    win.close();
    openedWindows.delete(routerPath);
    // eslint-disable-next-line sonarjs/no-dead-store
    win = undefined;
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
    if(win) win.webContents.send("SYSTEM:DATA", payload.data);
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
        win[1].webContents.send("SYSTEM:BROADCAST", {eventType, eventData: [...params]});
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

    mainWin.webContents.send("SYSTEM:MENU", entryName, payload);
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
 * Request a system menu refresh in the client process
 */
export const refreshSystemMenu = (): void => {

    mainWin.webContents.send("SYSTEM:REFRESH-MENU");
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

/**
 * Update the main window project
 *
 * @param clientProjectInfo - Project info to be passes to the client to setup UI etc.
 */
export const sendProjectUI = (clientProjectInfo: ClientProjectInfo): void => {

    mainWin.webContents.send("SYSTEM:project-send", clientProjectInfo);
};

/**
 * Send error notification from main process
 *
 * @param text - Text of the notification
 */
export const sendAlertMessage = (text: string, from?: string): void => {

    mainWin.webContents.send("SYSTEM:notification", "error", text, from ?? "");
};

/**
 * Push data to the client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param params - Parameters to send to the client process
 */
export const sendToClient = (id: string, channel: string, params: CtrlParams={}): void => {

    const channelName = id + ":" + channel;
    mainWin.webContents.send(channelName, params);
};

/**
 * Push structure data to the client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param renderInfo - Parameters to send to the client process
 */
export const sendToClientForRendering = (id: string,
                                         channel: string,
                                         renderInfo: StructureRenderInfo): void => {

    const channelName = id + ":" + channel;
    mainWin.webContents.send(channelName, renderInfo);
};

/**
 * Push polyhedra data to the client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param vertices - List of vertices coordinates for each polyhedron
 * @param centerAtomsColor - List of center atoms colors
 */
export const sendPolyhedraToClient = (id: string,
                                      channel: string,
                                      vertices: number[][],
                                      centerAtomsColor: string[]): void => {

    const channelName = id + ":" + channel;
    mainWin.webContents.send(channelName, vertices, centerAtomsColor);
};

/**
 * Ask the client to send a string.
 * For example the Viewer3D status stringified.
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @returns The string from client
 */
export const askClient = (id: string, channel: string): Promise<string> => {

    const channelName = id + ":" + channel;
    return new Promise((resolve) => {
        mainWin.webContents.send(channelName);
        ipcMain.once(channelName + "-response", (_event: unknown, answer: string): void => resolve(answer));
    });
};

/**
 * Push structure data to client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param vertices - Parameters to send to the client process
 */
export const sendVerticesToClient = (id: string, channel: string, vertices: number[]): void => {

    const channelName = id + ":" + channel;
    mainWin.webContents.send(channelName, vertices);
};

/**
 * Push orthoslice and isolines data to client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param data - Data to draw orthoslice and isolines
 */
export const sendIsoOrthoToClient = (id: string,
                                     channel: string,
                                     data: {
                                        vertices: number[];
                                        indices: number[];
                                        values: number[];
                                        isolineVertices: number[][];
                                        isolineValues: number[];
                                        params: CtrlParams;
                                     }): void => {

    const channelName = id + ":" + channel;
    mainWin.webContents.send(channelName,
                             data.vertices,
                             data.indices,
                             data.values,
                             data.isolineVertices,
                             data.isolineValues,
                             data.params);
};

/**
 * Push traces data to client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param segments - List of segments coordinates
 * @param colors - Colors of each segment
 */
export const sendTracesToClient = (id: string,
                                   channel: string,
                                   segments: number[][],
                                   colors: string[]): void => {

    const channelName = id + ":" + channel;
    mainWin.webContents.send(channelName, segments, colors);
};

/**
 * Push position clouds volumetric data to client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param volume - The volumetric data
 * @param limits - The limits of the volumetric data
 */
export const sendPositionCloudsToClient = (id: string,
                                           channel: string,
                                           volume: number[],
                                           limits: number[],
                                           count: number): void => {

    const channelName = id + ":" + channel;
    mainWin.webContents.send(channelName, volume, limits, count);
};

/**
 * Push isosurfaces data to client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param data - Data to draw isosurfaces
 */
export const sendIsosurfacesToClient = (id: string,
                                        channel: string,
                                        data: {
                                            indices: number[][];
                                            vertices: number[][];
                                            normals: number[][];
                                            isoValues: number[];
                                            params: CtrlParams;
                                        }): void => {

    const channelName = id + ":" + channel;
    mainWin.webContents.send(channelName,
                             data.indices,
                             data.vertices,
                             data.normals,
                             data.isoValues,
                             data.params);
};
