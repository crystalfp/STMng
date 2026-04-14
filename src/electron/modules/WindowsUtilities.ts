/**
 * Creating/closing windows and setup communications to them
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
import {app, BrowserWindow, nativeImage, ipcMain, dialog} from "electron";
import path from "node:path";
import {writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {attachTitlebarToWindow} from "custom-electron-titlebar/main";
import log from "electron-log";
import {setupMenu} from "./SystemMenu";
import {toClientSetup, sendAlertToClient} from "./ToClient";
import favicon from "../../assets/favicon.png";
import type {CtrlParams, WindowsParams} from "@/types";
import {isMaximized, setMaximized, setWindowSize, getWindowSize} from "./Preferences";

/** List of opened windows, main and secondary ones */
const openedWindows = new Map<string, BrowserWindow>();

/** The main window */
let mainWin: BrowserWindow;

/** True if this is the final exit without confirmation */
let finalExit = false;

/** Access needed directories */
const modulePath = (globalThis as unknown as {modulePath: string}).modulePath;
const {VITE_DEV_SERVER_URL} = process.env;
const mainSourceDirectory = path.dirname(fileURLToPath(modulePath));
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

    // Open main window as was the last run
    mainWin.once("ready-to-show", () => {

        setInitialSizes(mainWin);
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
               (_event, routerPath: string): void => {
                    closeSecondaryWindow(routerPath);
                });

    // Functions to manage a request to close the application
    ipcMain.on("WINDOW:EXIT-CONFIRMED", (): void => {
        finalExit = true;
        app.quit();
    });

    // Setup the system menu
    setupMenu(isDevelopment, mainWin);

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
const createSecondaryWindow = (params: WindowsParams): void => {

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
            preload: path.join(path.dirname(fileURLToPath(modulePath)), "preload.js"),
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

        secondaryWin.show();

        if(params.alwaysOnTop) secondaryWin.setAlwaysOnTop(true);

        // Manage the list of opened windows
        openedWindows.set(params.routerPath, secondaryWin);
        secondaryWin.on("close", () => {
            openedWindows.delete(params.routerPath);
        });
    });
};

// Temporary store the initial data for the new secondary window created
let paramsData: CtrlParams = {};

/**
 * Create a secondary window or update its data if already open
 *
 * @param params - Params for the created window
 */
export const createOrUpdateSecondaryWindow = (params: WindowsParams): void => {

    let isOpen = params.alreadyOpen;
    isOpen ??= openedWindows.has(params.routerPath);
    const channel = params.routerPath.slice(1);

    if(isOpen) {
        if(params.data) {

            const win = openedWindows.get(params.routerPath);
            if(win) win.webContents.send(`SYSTEM:DATA:${channel}`, params.data);
        }
    }
    else {
        if(params.data) {
            paramsData = structuredClone(params.data);
            ipcMain.handleOnce(`SYSTEM:INITIAL-DATA:${channel}`, (): CtrlParams => {
                return paramsData;
            });
        }

        createSecondaryWindow(params);
    }
};

/**
 * Setup the channel to take a snapshot of a secondary window
 */
export const setupChannelSnapshot = (): void => {

    ipcMain.on("SYSTEM:save-snapshot", (_event,
                                        payload: {
                                            routerPath: string;
                                            title: string;
                                            margin: number;
                                        }) => {

        const {routerPath, title, margin} = payload;
        if(!routerPath || !title || margin === undefined) return;

        const win = openedWindows.get(routerPath);
        if(!win) return;

        const file = dialog.showSaveDialogSync({
            title,
            filters: [
                {name: "PNG", extensions: ["png"]},
            ]
        });
        if(!file) return;

        win.capturePage()
            .then((img) => {

                const size = img.getSize();
                const cropped = img.crop({
                    x: 0,
                    y: 0,
                    width: size.width,
                    height: size.height - margin
                });
                const png = cropped.toPNG();
                writeFileSync(file, png);
            })
            .catch((error: Error) =>
                sendAlertToClient(`Error saving screenshot: ${error.message}`));
    });
};

// > Close the secondary window
/**
 * Close the secondary window
 *
 * @param routerPath - The router path of the created window
 */
const closeSecondaryWindow = (routerPath: string): void => {

    const win = openedWindows.get(routerPath);
    if(!win) return;

    win.close();
    openedWindows.delete(routerPath);
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
 * @param data - Data to be sent
 */
export const sendToSecondaryWindow = (routerPath: string, data: CtrlParams): void => {

    const channel = routerPath.slice(1);
    const win = openedWindows.get(routerPath);
    if(win) win.webContents.send(`SYSTEM:DATA:${channel}`, data);
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
 * @param windowPath - Path to the window on which the developer tools should be opened
 */
export const showDevToolsOnSecondaryWindow = (windowPath: string): void => {

    const win = openedWindows.get(windowPath);
    if(win) {

        win.webContents.closeDevTools();
        win.webContents.openDevTools();
    }
};

/**
 * The the main window initial size and save its changes
 *
 * @param win - Main window
 */
const setInitialSizes = (win: BrowserWindow): void => {

    if(isMaximized()) win.maximize();
    else {
        win.show();
        const dims = getWindowSize();
        win.setSize(dims[0], dims[1]);
    }

    win.addListener("resize", () => {
        const dims = win.getSize();
        setWindowSize(dims);
    });

    win.addListener("maximize", () => setMaximized(true));
    win.addListener("unmaximize", () => setMaximized(false));
};
