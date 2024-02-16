/**
 * Defines the main window menu
 *
 * @packageDocumentation
 */
import {Menu, shell, app, nativeTheme, dialog} from "electron";
import type {MenuItemConstructorOptions} from "electron";
// eslint-disable-next-line unicorn/prevent-abbreviations
import {broadcastMessage, showDevToolsOnSecondaryWindows, openMenuEntry} from "./WindowsUtilities";
import {setMainTheme} from "./Preferences";
import {loadRememberedProject, loadProjectAndRemember, saveProject, saveProjectAs} from "./Project";
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
                        }
                    }
                },
                {
                    label: "Load default project",
                    accelerator: "CommandOrControl+D",
                    click() {
                        loadRememberedProject(true);
                        disableSaveProjectEntry(true);
                    }
                },
                {type: "separator"},
                {
                    label: "Save project",
                    id: "saveProject",
                    accelerator: "CommandOrControl+S",
                    click() {
                        saveProject();
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
                        }
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
                {role: "forceReload"},
                {
                    role: "toggleDevTools",
                    enabled: isDevelopment,
                    visible: isDevelopment,
                    accelerator: "F12"
                },
                {
                    label: "DevTools on secondary",
                    type: "checkbox",
                    enabled: isDevelopment,
                    visible: isDevelopment,
                    accelerator: "CommandOrControl+F12",
                    checked: false,
                    click(event) {
                        showDevToolsOnSecondaryWindows(event.checked);
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
                }
            ]
        },
        {
            label: "&Help",
            submenu: [
                {
                    label: "STMng documentation",
                    click() {
                        const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
                        const DIST = path.join(mainSourceDirectory, "..", "dist");
                        const publicDir = app.isPackaged ? DIST : path.join(mainSourceDirectory, "..", "public");
                        const url = path.join(publicDir, "doc", "index.html");

                        void shell.openExternal(`file:///${url}`);
                    },
                },
                {
                    label: "Learn more",
                    click() {
                        void shell.openExternal("https://www.electronjs.org");
                    },
                },
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
    if(entry) entry.enabled = !disable;
};
