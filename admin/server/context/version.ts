import { AppVersion } from "kitres";
import Path from "path";
import {Folders} from "./folders";
import {context} from "./index";

export const VERSION = new AppVersion({
    project: Path.join( Folders.snapshot ),
    readonly: false,
    context: context.env,
    modes: { dev: "dev",  prod: "prod" }
});

global.VERSION = VERSION;