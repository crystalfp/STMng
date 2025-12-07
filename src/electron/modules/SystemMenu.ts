/**
 * Defines the main window menu
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {Menu, shell, app, nativeTheme, dialog, ipcMain,
        type MenuItemConstructorOptions, type BrowserWindow} from "electron";
import {existsSync} from "node:fs";
import {broadcastMessage, showDevToolsOnSecondaryWindow} from "./WindowsUtilities";
import {refreshSystemMenu, openMenuEntry, sendAlertToClient,
        getCurrentNode} from "./ToClient";
import {setMainTheme, isExtended, setExtended} from "./Preferences";
import {createProjectEditor, sendProjectToEditor} from "./ProjectEditor";
import {pm} from "./ProjectManager";
import {publicDirPath} from "./GetPublicPath";
import {showLogFile} from "./AccessLog";
import type {CtrlParams} from "@/types";

/**
 * Open documentation file
 *
 * @param kind - Kind of help file to visualize:
 *      - "top": Main entry point of documentation
 *      - "node": Help for node of the given type
 *      - "secondary": Help for a secondary window
 * @param file - Node name or window path for which the documentation should be shown.
 */
const openDocumentation = async (kind: "top" | "node" | "secondary", file?: string): Promise<void> => {

    if(!file && kind !== "top") {
        throw Error(`Invalid help file request for "${kind}"`);
    }

    let url;
    switch(kind) {
        case "node":
            url = publicDirPath(`doc/nodes/${file}.html`, true);
            break;
        case "secondary":
            url = publicDirPath(`doc/secondary/${file}.html`, true);
            break;
        case "top":
            url = publicDirPath("doc/index.html", true);
            break;
    }
    if(existsSync(url)) {
        const sts = await shell.openPath(url);
        if(sts) throw Error(`Error from help file "${file}.html" for "${kind}": ${sts}`);
        return;
    }
    throw Error(`Help file "${file}.html" for "${kind}" not found`);
};

let systemMenu: Menu;

// > Prepare the application menu
/**
 * Prepare the application menu
 *
 * @param isDevelopment - Set if the application is running under development
 *  or have developer tools set in production
 * @param mainWindow - Main application window for reload menu entry
 */
export const setupMenu = (isDevelopment: boolean, mainWindow: BrowserWindow): void => {

    const template: MenuItemConstructorOptions[] = [
        {
            label: "&File",
            submenu: [
                {
                    label: "Load project from…",
                    accelerator: "CommandOrControl+O",
                    click() {
                        const file = dialog.showOpenDialogSync({
                            title: "Load project",
                            properties: ["openFile"],
                            filters: [
                                {name: "STMng project", extensions: ["stm"]},
                            ]
                        });
                        if(file) {
                            const loadedDefaultProject = pm.loadProjectAndRemember(file[0]);
                            disableSaveProjectEntry(loadedDefaultProject);
                            sendProjectToEditor();
                        }
                    }
                },
                {
                    label: "Load default project",
                    accelerator: "CommandOrControl+D",
                    click() {
                        pm.loadRememberedProject(true);
                        disableSaveProjectEntry(true);
                        sendProjectToEditor();
                    }
                },
                {type: "separator"},
                {
                    label: "Save project",
                    id: "saveProject",
                    accelerator: "CommandOrControl+S",
                    click() {
                        pm.saveProject();
                        sendProjectToEditor();
                    }
                },
                {
                    label: "Save project as…",
                    accelerator: "CommandOrControl+Shift+S",
                    click() {
                        const file = dialog.showSaveDialogSync({
                            title: "Save project",
                            filters: [
                                {name: "STMng project", extensions: ["stm"]},
                            ]
                        });
                        if(file) {
                            void pm.saveProjectAs(file);
                            disableSaveProjectEntry(false);
                            sendProjectToEditor();
                        }
                    }
                },
                {type: "separator"},
                {
                    label: "Project editor",
                    click() {
                        createProjectEditor(pm.getProjectName());
                    }
                },
                {type: "separator"},
                {
                    label: "Quit application",
                    accelerator: "CommandOrControl+Q",
                    click() {
                        app.quit();
                    }
                },
            ],
        },
        {
            label: "&View",
            submenu: [
                {
                    label: "Reload",
                    accelerator: "CommandOrControl+R",
                    click() {
                        setTimeout(() => {openMenuEntry("clear-scene");}, 600);
                        mainWindow.reload();
                    }
                },
                {
                    role: "toggleDevTools",
                    enabled: isDevelopment,
                    visible: isDevelopment,
                    accelerator: "F12",
                    label: "Toggle DevTools"
                },
                {
                    label: "Show scene 3D",
                    enabled: isDevelopment,
                    visible: isDevelopment,
                    click() {
                        openMenuEntry("show-scene");
                    }
                },
                {type: "separator"},
                {role: "togglefullscreen", label: "Toggle full screen"},
                {
                    label: "Dark theme",
                    type: "checkbox",
                    accelerator: "CommandOrControl+T",
                    checked: nativeTheme.themeSource === "dark",
                    click(event) {
                        const theme = event.checked ? "dark" : "light";
                        setMainTheme(theme, true);
                        broadcastMessage("theme-change", theme);
                    }
                },
                {
                    label: "Extend viewer",
                    type: "checkbox",
                    accelerator: "CommandOrControl+E",
                    id: "toggleExtended",
                    checked: isExtended(),
                    click(event) {
                        setExtended(event.checked);
                        openMenuEntry("extend-viewer", event.checked ? "yes" : "no");
                        broadcastMessage("extended-screen");
                    }
                }
            ]
        },
        {
            label: "&Help",
            submenu: [
                {
                    label: "STMng documentation",
                    accelerator: "F1",
                    click() {
                        openDocumentation("top")
                            .catch((error: Error) => {
                                sendAlertToClient(`Error getting help for "STMng": ${error.message}`);
                            });
                    },
                },
                {
                    label: "Current node documentation",
                    accelerator: "CommandOrControl+F1",
                    click() {
                        getCurrentNode().then((currentNode) => {
                            void openDocumentation("node", currentNode);
                        })
                        .catch((error: Error) => {
                            sendAlertToClient(`Error getting help: ${error.message}`);
                        });
                    }
                },
                {type: "separator"},
                {
                    label: "Show application log",
                    click() {
                        showLogFile();
                    }
                },
                {type: "separator"},
                {
                    label: "About",
                    click() {
                        openMenuEntry("show-versions");
                    }
                },
            ]
        }
    ];

    // Build the menu
    systemMenu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(systemMenu);
};

/**
 * Disable menu entry "Save project"
 *
 * @param disable - Disable save project menu entry if true
 */
export const disableSaveProjectEntry = (disable: boolean): void => {

    const entry = systemMenu.getMenuItemById("saveProject");
    if(entry) {
        entry.enabled = !disable;
        refreshSystemMenu();
    }
};

/**
 * Setup channel to toggle extended view from client
 *
 * @param isDevelopment - Set if the application is running under development or
 *                        have developer tools set in production
 */
export const setupChannelMenu = (isDevelopment: boolean): void => {

    ipcMain.on("SYSTEM:extended", (_event, params: CtrlParams) => {

        setExtended(!params.normalScreen);
        const entry = systemMenu.getMenuItemById("toggleExtended");
        if(entry) {
            entry.checked = !params.normalScreen;
            refreshSystemMenu();
        }
    });

    ipcMain.on("SYSTEM:secondary-key", (_event, params: CtrlParams) => {

        const key = params.key as string;
        if(!key) return;
        const request = params.request as string;
        if(!request) return;

        // Show help for the secondary window
        if(key === "F1") {
            openDocumentation("secondary", request)
                .catch((error: Error) => {
                    sendAlertToClient(`Error getting help for secondary window: ${error.message}`);
                });
        }
        // Open developer tools on the secondary window
        else if(key === "F12" && isDevelopment) {
            showDevToolsOnSecondaryWindow(request);
        }
    });
};
