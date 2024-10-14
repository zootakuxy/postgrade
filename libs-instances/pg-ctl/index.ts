import fs from "fs";
import { spawn} from "child_process";

import {ConnectionConfig, Pool} from "pg";
import Path from "path";
import { OutputResult } from "kitres/src/core/system/master";
import {PgCore, scriptUtil, TempScript} from "kitres";
import { ProcessListen } from "kitres/src/core/util/process";
import {System} from "kitres/src/core/system";
import { Win32 } from "kitres/src/core/system/os/win32";


export type PGAuthMethod = "trust"|"rejected"|"md5"|"password"|"reject"|"scram-sha-256"|"gss"|"sspi"|"ident"|"peer"|"pam"|"ldap"|"radius"|"cert";
export type InitDBOptions = {
    cli?:string,
    cliMethod?:"initdb"
    auth?:PGAuthMethod
    password?:string,
    noLocale?:boolean,
    superuser?:string
    directory:string
    encoding?:BufferEncoding
}

export type InitResult = {
    result:boolean,
    stdout?:string,
    stderr?:string,
    message: string
}

export type ServiceOptions = {
    service:string,
    directory:string
}

export type Response = OutputResult &{
    result?:boolean,
    message?:string
}

export type ClusterStatus = "NotFound"|"BadCluster"|"Stooped"|"Running"|"Unknown"|"ERROR"
export type ClusterPidStatus = "NotFoundPid"|"BadPid"|"Stooped"|"Running"|"ERROR"

export type ClusterStatusResponse = Response & {
    status?: ClusterStatus
}

export type ClusterPidStatusResponse = {
    postmaster?:{
        PID:number
        DataDirectory:string
        PostmasterStartTimestamp:string
        PortNumber:number
        FirstUnixSocketDirectoryPath:string
        First_listen_addresses:string
        SharedMemoryKey:number
        PostmasterStatus:"ready"|"starting"|"stopping"|"standby"|string,
    }
    status?:ClusterPidStatus
}

export class PgCtl {
    static initdb( opts:InitDBOptions, callback:( error:Error, result?:InitResult )=>void ){
        try {
            let args = [];
            let password:TempScript;
            let method = {
                initdb:()=>{
                    let directory = opts.directory;
                    if( opts.auth ) args.push( "-A", opts.auth );
                    if( opts.password ){
                        password = scriptUtil.tempScript(`${opts.password}`, {  extension:".PGPASS" } )
                        args.push( `--pwfile`, password.filename );
                    }
                    if( opts.noLocale ) args.push( "--no-locale" );
                    if( opts.superuser ) args.push( "--username", opts.superuser );
                    if( opts.encoding ) args.push( "--encoding", opts.encoding );

                    if( !fs.existsSync( directory ) ) fs.mkdirSync( directory, { recursive: true } );
                    args.push( "-D", directory );
                }
            }

            let useMethod = method[ opts.cliMethod ];
            if( typeof useMethod !== "function" ) useMethod = method.initdb;
            useMethod();

            let child = spawn( opts.cli || "initdb", args );
            let listen = new ProcessListen( child );
            listen.on( "finally", (result, error) => {
                if( password ) password.done();
                if( error ) return callback( error );
                if( !result ) return callback( new Error( `Falha inesperada ao inicializar o cluster` ) );
                if( !result || error ) return callback( error );
                if( result.code === 0 ){
                    return callback( null, {
                        result: true,
                        message: "success"
                    })
                }
                let message = Buffer.concat( result.output ).toString();
                return callback( new Error( `Não pode inicializar o cluster code = "${ result.code }" Message = "${ message }"` ), {
                    result: false,
                    stdout: Buffer.concat( result.stdout ).toString().trim(),
                    stderr: Buffer.concat( result.stderr ).toString().trim(),
                    message: message
                });
            });

            return listen;

        } catch ( e ){
            callback( null, e as any);
        }
    }

    static statusPid( opts:ServiceOptions, resolve:( error:Error, result?:ClusterPidStatusResponse )=>void);
    static statusPid( opts:ServiceOptions ):Promise<{error?:Error, status?:ClusterPidStatusResponse}>
    static statusPid( opts:ServiceOptions, resolve?:( error:Error, result?:ClusterPidStatusResponse )=>void):void | Promise<{error?:Error, status?:ClusterPidStatusResponse}>{

        let GetClusterPidStatus = ( resolve?:( error:Error, result?:ClusterPidStatusResponse )=>void )=>{

            if( !fs.existsSync( Path.join( opts.directory, "postmaster.pid") ) ) return resolve( null, {
                status: "NotFoundPid"
            } );

            /*
                PID	17454	PostgreSQL 7.0
                Data directory	/var/lib/pgsql/data	PostgreSQL 7.1
                postmaster start timestamp	1603954420	PostgreSQL 9.1	Unix epoch
                Port number	5432	PostgreSQL 9.1
                First Unix socket directory path	/tmp	PostgreSQL 9.1	empty if none
                First [listen_addresses|[listen_address]]	127.0.0.1	PostgreSQL 9.1	IP address or "*"; empty if no TCP port
                shared memory key	5432001 9437184	PostgreSQL 7.1	empty on Windows
                postmaster status	ready	PostgreSQL 10	one of starting, stopping, ready, standby
             */

            let lines = fs.readFileSync( Path.join( opts.directory, "postmaster.pid")).toString().split( "\n" );
            let [ PID, dataDir, startTimeStamp, portNumber, firstUnixSocketDirectoryPatch,listen_addresses, sharedMemory, status]=lines.map( value => value.trim());

            let response:ClusterPidStatusResponse = {
                postmaster: {
                    PID: Number( PID ),
                    DataDirectory: dataDir,
                    First_listen_addresses: listen_addresses,
                    FirstUnixSocketDirectoryPath: firstUnixSocketDirectoryPatch,
                    PortNumber: Number( portNumber ),
                    PostmasterStatus: status as any,
                    PostmasterStartTimestamp: startTimeStamp,
                    SharedMemoryKey: Number( sharedMemory )
                }
            }


            const exec = require('child_process').exec;

            Win32.taskList( (error, list) => {
                if( error ){
                    response.status = "ERROR";
                    return resolve( error, response );
                }
                let running = list.find( value => value.PID === response.postmaster.PID );
                if( !running ) response.status = "Stooped";
                else if( running.Image_Name !== "postgres.exe" ) response.status = "BadPid";
                else response.status = "Running"
                return  resolve( null, response );

            });
        }

        if( typeof resolve === "function" ) return GetClusterPidStatus( resolve );
        else return new Promise( resolve => {
            GetClusterPidStatus( (error, status) => {
                resolve({ error, status })
            })
        });
    }



    static status( opts:ServiceOptions, response:( error:Error, result:ClusterStatusResponse )=>void);
    static status( opts:ServiceOptions ):Promise<{ error:Error, status:ClusterStatusResponse }>
    static status( opts:ServiceOptions, response?:( error:Error, result:ClusterStatusResponse )=>void):void|Promise<{ error:Error, status:ClusterStatusResponse }>{

        let GetClusterStatus = ( response?:( error:Error, result:ClusterStatusResponse )=>void )=>{
            let server = System.elevateSpawn( "pg_ctl", [ "status",
                "-D", opts.directory
            ]);
            server.on("result", (error, result) => {
            /*
                Running {
                    code = 0
                    result = true
                    stdout.includes( "pg_ctl: server is running" )
                } Stopped {
                    code = 3
                    result = false
                    stdout.includes( "pg_ctl: no server running" )
                } NotFound {
                    code = 4
                    result = false
                    stdout.includes( "pg_ctl: directory "C:/var/workspace/brainsoft/kitres-collection/kitres/var/base-123" does not exist" )
                } BadCluster {
                    code = 4
                    result = false
                    stdout.includes( "pg_ctl: directory "C:/var/workspace/brainsoft/kitres-collection/kitres/var" is not a database cluster directory\r\n'" )
                }
             */

            if( error ) return response( error, result );
            if( !result ) return response( new Error( "No result output"), result );
            let resp:ClusterStatusResponse = result as any;
            resp.result =  false;
            let stdout = result.stdout.toString().trim();
            let stderr = result.stderr.toString().trim();
            let files = [];

            if( result.code !== 0 ){
                console.log( "PG_CTL status stderr", stderr );
                console.log( "PG_CTL status stdout", stdout );
            }

            if( fs.existsSync( opts.directory ) ){
                files = fs.readdirSync( opts.directory );
            }

            if( files.length === 0 ){
                resp.result = false;
                resp.status = "NotFound";
                resp.message = stdout;
            } else if( result.code === 0 && stdout.includes( "pg_ctl: server is running" ) ){
                resp.result = true;
                resp.status = "Running";
                resp.message = stdout
            } else if( result.code === 3 && stdout.includes( "pg_ctl: no server running") ){
                resp.result = false;
                resp.status = "Stooped";
                resp.message = stdout;
            } else if( result.code === 4 && stderr.includes( "pg_ctl: directory") && stderr.includes( "does not exist") ){
                resp.result = false;
                resp.status = "NotFound";
                resp.message = stdout;
            } else if( result.code === 4 && stderr.includes( "pg_ctl: directory") && stderr.includes( "is not a database cluster directory" ) ){
                resp.result = false;
                resp.status = "BadCluster";
                resp.message = stdout;
            } else {
                resp.result = false;
                resp.status = "Unknown";
                resp.message = stderr||stdout;
            }
            resp["BadCluster"] = result.code === 4 && stderr.includes( "pg_ctl: directory") && stderr.includes( "is not a database cluster directory" );
            resp["NotFound"] = result.code === 4 && stderr.includes( "pg_ctl: directory") && stderr.includes( "does not exist");

            if( !resp.message ) resp.message = stdout;
            if( !resp.message ) resp.message = stderr;
            return response( error, resp);
        });
        }

        if( typeof response === "function" ) return GetClusterStatus( response );
        else return new Promise( resolve => {
            GetClusterStatus( (error, status) => {
                resolve({ error, status });
            })
        });
    }


    static test( opts:ConnectionConfig, response:( error:Error, result:boolean ) => void ) {
        let pgCore = new PgCore( () => new Pool( opts ) );
        pgCore.execute("select now()", [], {
            onResult(error, result) {
                if( error ) return response( error, false );
                return response( error, result.rows.length === 1 );
            }
        })
    }

    static launcher( directory:string ){
        let child = spawn("pg_ctl", [
            "start",
            "-D", directory,
        ]);
    }

    static end( directory:string ){
        let child = spawn("pg_ctl", [
            "stop",
            "-D", directory,
        ] );
        return new ProcessListen(child);
    }

    static register( opts:ServiceOptions, response:( error:Error, response:Response )=>void ){
        let register = System.elevateSpawn( "pg_ctl", [
            "register",
            "-D", opts.directory,
            "-N", opts.service
        ]);

        register.on( "result", ( error, result ) => {
            if( error ) return response( error, result );
            if( !result ) return response( new Error( "No result output"), result );
            if( result.code !== 0 ){
                return response( new Error( result.stderr?.toString().trim?.()), result );
            }
            return response( null, Object.assign( result , { result: true }) );
        });
    }

    static unregister( opts:ServiceOptions, response:( error:Error, response:Response )=>void){
        let unregister = System.elevateSpawn( "pg_ctl", [
            "unregister",
            "-D", opts.directory,
            "-N", opts.service
        ]);

        unregister.on( "result", ( error, result ) => {
            if( error ) return response( error, result );
            if( !result ) return response( new Error( "No result output"), result );
            if( result.code !== 0 ){
                return response( new Error( result.stderr?.toString().trim?.()), result );
            }
            return response( null, Object.assign( result , { result: true }) );
        });
    }

    static stop( service ){
        // let listen = WinSystem.rumElevated( `
        //     sc start ${ service };
        // `, {});
        // listen.on( "finally", result => {
        //
        // });
    }

}