/**
 * Entry point for the main process.
 * It parse command line parameters and initializes all the channels between main processes and client windows.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @file main.ts.ts
 * @since Tue Jul 09 2024
 */
import {Command, Option} from "commander";
import log from "electron-log";
import pkg from "../../package.json";

// > Command line parsing
const program = new Command("STMng");
program
    .version(pkg.version)
    .description(pkg.description)
    .usage("[options] [project-file]")
    .addOption(new Option("-t, --theme <theme>", "user interface theme").choices(["dark", "light"]))
    .option("-d, --default", "force load of default project")
	.option("-v, --verbose", "verbose")
    .addHelpText("before", " ")
    .addHelpText("after", " ");

if(import.meta.env.DEV) program.option("--no-sandbox", "forced during development");
program.parse(process.argv, {from: "electron"});

interface ProgramOptions {
    theme?: "dark" | "light";
    default?: boolean;
    verbose?: boolean;
}
const options = program.opts<ProgramOptions>();

// > Setup the main process
// Initialize the logger
log.initialize();
log.transports.console.level = options.verbose ? "silly" : "warn";
log.transports.file.level = options.verbose ? "silly" : "warn";
log.errorHandler.startCatching({showDialog: false});
log.eventLogger.startLogging();
