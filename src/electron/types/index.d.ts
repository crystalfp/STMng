/**
 * Types specific for the main process.
 *
 * @packageDocumentation
 */

/** Parameters for the window creation */
export interface WindowsParams {
    /** The router path for the created window (should also be in src/main.ts) */
    routerPath: string;
    /** Width of the window */
    width: number;
    /** Height of the window */
    height: number;
    /** Title of the window */
    title: string;
    /** Data to be passed to the window when it is ready */
    data?: string;
}
