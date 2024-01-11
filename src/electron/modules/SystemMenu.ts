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
import {loadProject, getDefaultProject, saveProject} from "./Project";
import path from "node:path";
import {fileURLToPath} from "node:url";

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
                                {name: "STM project", extensions: ["json"]},
                            ]
                        });
                        if(file) loadProject(file[0]);
                    }
                },
                {
                    label: "Load default project",
                    accelerator: "CommandOrControl+D",
                    click() {
                        loadProject(getDefaultProject());
                    }
                },
                {
                    label: "Save project",
                    accelerator: "CommandOrControl+S",
                    click() {
                        const file = dialog.showSaveDialogSync({
                            title: "Save project",
                            filters: [
                                {name: "STM project", extensions: ["json"]},
                            ]
                        });
                        if(file) saveProject(file);
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
                // {type: "separator"},
                // {role: "resetZoom"},
                // {role: "zoomIn"},
                // {role: "zoomOut"},
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
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
};
