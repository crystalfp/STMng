/**
 * Setup IPC between main process and client windows.
 * Create titlebar and export set title and refresh menu functions.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {exposeElectronAPI} from "@electron-toolkit/preload";
import {contextBridge, nativeImage} from "electron";
import {TitlebarColor, CustomTitlebar} from "custom-electron-titlebar";
import favicon from "../assets/favicon.png";

// > Setup IPC between main and client
exposeElectronAPI();

/**
 * The load event containing the requested location
 * @notExported
 */
interface DOMContentLoadedEvent {
    target: {
        location: {
            href: string;
        };
    };
}

/**
 * Handler for window content ready
 *
 * @param loadEvent - Event fired on DOM content loaded
 */
const onContentLoaded = (loadEvent: Event): void => {

    // Specific operations for each kind of window opened
    const {href} = (loadEvent as unknown as DOMContentLoadedEvent).target!.location;
    if(href.endsWith("#/")) {

        // Setup the customized titlebar in the main window only
        const ct = new CustomTitlebar({
            backgroundColor: TitlebarColor.fromHex("#202120"),
            titleHorizontalAlignment: "center",
            icon: nativeImage.createFromDataURL(favicon)
        });

        // Export set title and refresh menu functions
        contextBridge.exposeInMainWorld("api", {
            setTitle: (title: string): CustomTitlebar => ct.updateTitle(title),
            refreshMenu: (): void => void ct.refreshMenu()
        });
    }
};

globalThis.addEventListener("DOMContentLoaded", onContentLoaded);
