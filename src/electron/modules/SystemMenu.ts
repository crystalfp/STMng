/**
 * Defines the main window menu
 *
 * @packageDocumentation
 */
import {Menu, shell, app, nativeTheme, ipcMain, dialog} from "electron";
import type {MenuItemConstructorOptions} from "electron";
// eslint-disable-next-line unicorn/prevent-abbreviations
import {broadcastMessage, showDevToolsOnSecondaryWindows, openMenuEntry} from "./WindowsUtilities";
import {setMainTheme} from "./Preferences";
import {loadProject, saveProject} from "./Project";

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
                            title: "Select project",
                            properties: ["openFile"],
                            filters: [
                                {name: "STM project", extensions: ["prj"]},
                            ]
                        });
                        if(file) loadProject(file[0]);
                    }
                },
                {
                    label: "Save project",
                    accelerator: "CommandOrControl+S",
                    click() {
                        const file = dialog.showSaveDialogSync({
                            title: "Select project save file",
                            filters: [
                                {name: "STM project", extensions: ["prj"]},
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
                {type: "separator"},
                {role: "resetZoom"},
                {role: "zoomIn"},
                {role: "zoomOut"},
                {type: "separator"},
                {role: "togglefullscreen"},
                {
                    label: "Dark theme",
                    type: "checkbox",
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

    // Receive enable/disable commands from the client
	ipcMain.handle("APP:MENU-ENTRY-DISABLE", (_event, payload: {menuEntryId: string; disable: boolean}) => {

        const entry = menu.getMenuItemById(payload.menuEntryId);
        if(entry) entry.enabled = !payload.disable;
    });
};
