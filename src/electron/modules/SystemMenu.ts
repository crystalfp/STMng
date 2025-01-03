/**
 * Defines the main window menu
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {Menu, shell, app, nativeTheme, dialog, ipcMain, type MenuItemConstructorOptions} from "electron";
import path from "node:path";
import {existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
// eslint-disable-next-line unicorn/prevent-abbreviations
import {broadcastMessage, showDevToolsOnSecondaryWindows, sendAlertMessage,
        refreshSystemMenu, openMenuEntry, getCurrentNode} from "./WindowsUtilities";
import {setMainTheme, isExtended, setExtended} from "./Preferences";
import {createProjectEditor, sendProjectToEditor} from "./ProjectEditor";
import {pm} from "./ProjectManager";
import {showLogFile} from "./AccessLog";
import type {CtrlParams} from "@/types";

/**
 * Open documentation file
 *
 * @param node - Node name for which the documentation should be shown.
   If missing show general STMng documentation
 * @returns Promise from openExternal
 * @throws Error.
 * If the help file is not found
 */
const openDocumentation = (node?: string): Promise<void> => {

    const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
    let url;
    if(node) {
        url = app.isPackaged ?
            path.resolve(process.resourcesPath, `app.asar.unpacked/dist/doc/nodes/${node}.html`) :
            path.join(mainSourceDirectory, "..", "public", "doc", "nodes", `${node}.html`);

    }
    else {
        url = app.isPackaged ?
            path.resolve(process.resourcesPath, "app.asar.unpacked/dist/doc/index.html") :
            path.join(mainSourceDirectory, "..", "public", "doc", "index.html");
    }

    if(!existsSync(url)) throw Error("Help file not found");
    return shell.openExternal(`file:///${url}`);
};

let systemMenu: Menu;

// > Prepare the application menu
/**
 * Prepare the application menu
 *
 * @param isDevelopment - Set if the application is running under development or have developer tools
   set in production
 */
export const setupMenu = (isDevelopment: boolean): void => {

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
                {role: "reload"},
                {
                    role: "forceReload",
                    enabled: isDevelopment,
                    visible: isDevelopment,
                    label: "Force reload"
                },
                {
                    role: "toggleDevTools",
                    enabled: isDevelopment,
                    visible: isDevelopment,
                    accelerator: "F12",
                    label: "Toggle DevTools"
                },
                {
                    label: "DevTools on secondary",
                    enabled: isDevelopment,
                    visible: isDevelopment,
                    accelerator: "CommandOrControl+F12",
                    click() {
                        showDevToolsOnSecondaryWindows();
                    }
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
                        openDocumentation()
                            .catch((error: Error) => {
                                sendAlertMessage(`Error getting help for "STMng": ${error.message}`);
                            });
                    },
                },
                {
                    label: "Current node documentation",
                    accelerator: "CommandOrControl+F1",
                    click() {
                        let currentNodeInError: string;
                        getCurrentNode().then((currentNode) => {
                            if(!currentNode) currentNode = "../index";
                            currentNodeInError = currentNode;
                            return openDocumentation(currentNode);
                        })
                        .catch((error: Error) => {
                            sendAlertMessage(`Error getting help for "${currentNodeInError}": ${error.message}`);
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
                    accelerator: "CommandOrControl+A",
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
 */
export const setupChannelMenu = (): void => {

    ipcMain.on("SYSTEM:extended", (_event: unknown, params: CtrlParams) => {

        setExtended(!params.normalScreen as boolean);
        const entry = systemMenu.getMenuItemById("toggleExtended");
        if(entry) {
            entry.checked = !params.normalScreen as boolean;
            refreshSystemMenu();
        }
    });
};
