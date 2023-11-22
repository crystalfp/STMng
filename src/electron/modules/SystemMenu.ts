/**
 * Defines the main window menu
 *
 * @packageDocumentation
 */
import {Menu, shell, app, nativeTheme, ipcMain} from "electron";
import type {MenuItemConstructorOptions} from "electron";
// eslint-disable-next-line unicorn/prevent-abbreviations
import {createSecondaryWindow, broadcastMessage, showDevToolsOnSecondaryWindows,
        openMenuEntry, openMenuEntryWithAnswer} from "./WindowsUtilities";
import {setMainTheme} from "./Preferences";

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
                    label: "Quit application",
                    accelerator: "CommandOrControl+Q",
                    click() {
                        void openMenuEntryWithAnswer("quit").then((doQuit) => {
                            if(doQuit === "yes") app.quit();
                        });
                    }
                },
            ],
        },
        {
            label: "&Admin",
            submenu: [
                {
                    label: "Configuration editor",
                    click() {
                        createSecondaryWindow(null, {routerPath: "/config", width: 1020, height: 700, title: "Edit configuration"});
                    }
                },
                {
                    label: "Colormaps editor",
                    click() {
                        createSecondaryWindow(null, {routerPath: "/colors", width: 1340, height: 360, title: "Edit colors"});
                    }
                },
                {
                    label: "Tags editor",
                    click() {
                        createSecondaryWindow(null, {routerPath: "/tags", width: 800, height: 550, title: "Tags editor"});
                    }
                },
                {type: "separator"},
                {
                    id: "entryArchive", // Needed to update menu entry
                    label: "Archive marked",
                    click() {
                        openMenuEntry("archive-marked");
                    }
                },
                {
                    id: "entryPurge",
                    label: "Purge deleted",
                    click() {
                        openMenuEntry("purge-deleted");
                    }
                },
                {
                    id: "entryQueries",
                    label: "Remove saved queries",
                    click() {
                        openMenuEntry("delete-queries");
                    }
                },
                {type: "separator"},
                {
                    label: "Set font size",
                    click() {
                        openMenuEntry("set-font-size");
                    }
                },
                {
                    label: "Set tile size",
                    click() {
                        openMenuEntry("set-tile-size");
                    }
                },
            ]
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
