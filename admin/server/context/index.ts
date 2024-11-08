import cluster from "cluster";
import {EnvMode, EnvOptions} from "../../env";
import { manifest } from "./manifest";
import {nanoid} from "nanoid";

export class Context {

    env:EnvOptions;
    manifest: typeof manifest
    mode: EnvMode
    instanceCheck: string;

    constructor() {
        this.env = {} as any;
        this.manifest = manifest;
        this.mode = "dev";
        this.instanceCheck  = nanoid( 64 );
    }

    define( env:EnvOptions ){
        this.env = Object.assign( this.env, env )
        this.mode  = env.MODE || "dev";
    }

    get tag(){
        if( cluster.isWorker ) return `[${ manifest.name }@${cluster.worker.id}]`;
        return `[${ manifest.name }]`;
    }
}

export const context = new Context();

