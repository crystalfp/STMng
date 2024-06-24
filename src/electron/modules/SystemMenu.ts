/**
 * Defines the main window menu
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import {Menu, shell, app, nativeTheme, dialog} from "electron";
import type {MenuItemConstructorOptions} from "electron";
// eslint-disable-next-line unicorn/prevent-abbreviations
import {broadcastMessage, showDevToolsOnSecondaryWindows, sendErrorNotification,
        refreshSystemMenu, openMenuEntry, getCurrentNode} from "./WindowsUtilities";
import {setMainTheme, isExtended, setExtended} from "./Preferences";
import {loadRememberedProject, loadProjectAndRemember, saveProject, sendProjectToEditor,
        saveProjectAs, createProjectEditor} from "./Project";
import path from "node:path";
import {fileURLToPath} from "node:url";

let systemMenu: Menu;

// > Prepare the application menu
/**
 * Prepare the application menu
 */
export const setupMenu = (): void => {

    const isDevelopment = import.meta.env.DEV;

    const template: MenuItemConstructorOptions[] = [
        {
            label: "&File",
            submenu: [
                {
                    label: "Load project",
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
                            const loadedDefaultProject = loadProjectAndRemember(file[0]);
                            disableSaveProjectEntry(loadedDefaultProject);
                            sendProjectToEditor();
                        }
                    }
                },
                {
                    label: "Load default project",
                    accelerator: "CommandOrControl+D",
                    click() {
                        loadRememberedProject(true);
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
                        saveProject();
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
                            saveProjectAs(file);
                            disableSaveProjectEntry(false);
                            sendProjectToEditor();
                        }
                    }
                },
                {type: "separator"},
                {
                    label: "Show project",
                    click() {
                        createProjectEditor();
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
                },
                {
                    role: "toggleDevTools",
                    enabled: isDevelopment,
                    visible: isDevelopment,
                    accelerator: "F12"
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
                {role: "togglefullscreen"},
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
                    label: "Extended viewer",
                    type: "checkbox",
                    accelerator: "CommandOrControl+E",
                    checked: isExtended(),
                    click(event) {
                        setExtended(event.checked);
                        openMenuEntry("extend-viewer", event.checked ? "yes" : "no");
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

                        const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
		                const url = app.isPackaged ?
                            path.resolve(process.resourcesPath, "app.asar.unpacked/dist/doc/index.html") :
                            path.join(mainSourceDirectory, "..", "public", "doc", "index.html");
                        void shell.openExternal(`file:///${url}`);
                    },
                },
                {
                    label: "Current node documentation",
                    click() {
                        let currentNodeInError: string;
                        getCurrentNode().then((currentNode) => {
                            if(!currentNode) currentNode = "../index";
                            currentNodeInError = currentNode;
                            const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
                            const url = app.isPackaged ?
                                path.resolve(process.resourcesPath,
                                                `app.asar.unpacked/dist/doc/nodes/${currentNode}.html`) :
                                path.join(mainSourceDirectory, "..", "public", "doc", "nodes",
                                                `${currentNode}.html`);
                            return shell.openExternal(`file:///${url}`);
                        })
                        .catch((error: Error) => {
                            sendErrorNotification(`Error getting help for "${currentNodeInError}": ${error.message}`);
                        });
                    }
                },
                {
                    label: "Learn more",
                    click() {
                        void shell.openExternal("https://www.electronjs.org");
                    },
                },
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
