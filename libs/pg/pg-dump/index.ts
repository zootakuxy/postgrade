import {spawn} from "child_process";
import {createOutputCollector, ProcessListenerEvent } from "kitres/src/core/util/process";
import {BaseEventEmitter} from "kitres";

export type DumpOptions = {
    cli?:string
    hostname:string,
    database:string,
    password:string,
    port:number|string,
    username:string,
    filename:string,
    schemas:string[]
}

export interface PgDumpEvents extends ProcessListenerEvent{

}

export class PgDump extends BaseEventEmitter<PgDumpEvents>{
    private readonly opts:DumpOptions;
    constructor( opts:DumpOptions) {
        super();
        this.opts = opts;
    }

    now( onComplete:( error:Error )=>void){
        let opts =  this.opts;
        let dumper = ( onDump: ( error:Error)=>void )=>{
            let args:string[] = [
                "-h", opts.hostname,
                "-p", opts.port.toString(),
                "-U", opts.username,
                "-d", opts.database,
                "-cOv",
                "--if-exists",
                "-f", opts.filename
            ];

            if( Array.isArray( opts.schemas ) ){
                opts.schemas.forEach( schema => {
                    args.push( "-n", schema );
                });
            }

            let _cli:string = opts.cli || "pg_dump";

            let child = spawn( _cli, args, {
                env: {
                    PGPASSWORD: opts.password
                }
            });

            let outputs = createOutputCollector( child, this.listener());

            child.on( "exit", code => {

            })

            child.on("exit", (code, signal) => {

            })
        }
    }
}