/**
 * Creating/closing windows and setup communications to them
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {app, BrowserWindow, nativeImage, ipcMain} from "electron";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {attachTitlebarToWindow} from "custom-electron-titlebar/main";
import log from "electron-log";
import {setupMenu} from "./SystemMenu";
import {toClientSetup, sendAlertToClient} from "./ToClient";
import favicon from "../../assets/favicon.png";
import type {WindowsParams} from "@/types";

/** List of opened windows, main and secondary ones */
const openedWindows = new Map<string, BrowserWindow>();

/** The main window */
let mainWin: BrowserWindow;

/** True if this is the final exit without confirmation */
let finalExit = false;

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

    // Attach fullscreen (f11 and not 'maximized') && focus listeners
    attachTitlebarToWindow(mainWin);

    // Open main window full screen
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

    // Functions to manage a request to close a secondary window
    ipcMain.on("WINDOW:CLOSE",
               (_event, routerPath: string): void => closeSecondaryWindow(routerPath));

    // Functions to manage a request to close the application
    ipcMain.on("WINDOW:EXIT-CONFIRMED", (): void => {
        finalExit = true;
        app.quit();
    });

    // Setup the system menu
    setupMenu(isDevelopment);

    // Setup access to client windows
    toClientSetup(mainWin.webContents);

    // Ask confirmation then close any opened secondary window and quit
    mainWin.on("close", (event) => {

        if(finalExit) {
            for(const win of openedWindows) {
                if(win[0] !== "/") win[1].close();
            }
        }
        else {
            event.preventDefault();
            mainWin.webContents.mainFrame.send("WINDOW:CONFIRM-EXIT");
        }
    });
};

// > Create a secondary window
/**
 * Create a secondary window
 *
 * @param params - Params for the created window
 */
export const createSecondaryWindow = (params: WindowsParams): void => {

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
            devTools: true
        }
    });
    if(!secondaryWin) {
        sendAlertToClient("Cannot create secondary window");
        return;
    }
    secondaryWin.removeMenu();

    // Load the content and show it
    const url = VITE_DEV_SERVER_URL ?
                        `${VITE_DEV_SERVER_URL}#${params.routerPath}` :
                        `file://${mainSourceDirectory}/../dist/index.html#${params.routerPath}`;
    secondaryWin.loadURL(url)
        .catch((error: Error) => {
            log.error(error);
        });

    secondaryWin.once("ready-to-show", () => {
        if(params.data) {
            setTimeout(() => secondaryWin.webContents.send("SYSTEM:DATA", params.data), 600);
        }
        secondaryWin.show();

        // Manage the list of opened windows
        openedWindows.set(params.routerPath, secondaryWin);
        secondaryWin.on("close", () => {
            openedWindows.delete(params.routerPath);
        });
    });
};

// > Close the secondary window
/**
 * Close the secondary window
 *
 * @param routerPath - The router path of the created window
 */
const closeSecondaryWindow = (routerPath: string): void => {

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
 * @param routerPath - The router path of the created window to check
 * @returns True if the window is open
 */
export const isSecondaryWindowOpen = (routerPath: string): boolean => openedWindows.has(routerPath);

// > Send data to a secondary window
/**
 * Send data to a secondary window
 *
 * @param routerPath - Router path of the secondary window
 * @param data - Data to be sent (normally JSON encoded data)
 */
export const sendToSecondaryWindow = (routerPath: string, data: string): void => {

    const win = openedWindows.get(routerPath);
    if(win) win.webContents.send("SYSTEM:DATA", data);
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

// > Show developer tools on a secondary window
/**
 * Show developer tools on a secondary window
 *
 * @param path - Path to the window on which the developer tools should be opened
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
export const showDevToolsOnSecondaryWindow = (path: string): void => {

    const win = openedWindows.get(path);
    if(win) {

        win.webContents.closeDevTools();
        win.webContents.openDevTools();
    }
};
