import { AppVersion } from "kitres";
import Path from "path";

export const VERSION = new AppVersion<"dev">({
    project: Path.join( __dirname, /*language=file-reference*/ `.` ),
    readonly: false,
    context: {},
    modes: { dev: "dev",  prod: "prod" }
});

global.VERSION = VERSION;