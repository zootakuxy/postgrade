import {Flow, FlowResponse, OutFlow, SteepFlow} from "kitres";
import {DBFlowResponse, InstallationLocation, PostgresContext, PostgresContextSteep} from "../index";
import os from "os";
import {System} from "kitres/src/core/system";
import Path from "path";
import {ProcessListen} from "kitres/src/core/util/process";
import {lookupPostgresRegister, PgInstallation} from "../../pg-register";
import fs from "fs";

class RecognizeFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>{
    readonly identifier =  PostgresContextSteep.SETUP;
    readonly steeps =  PostgresContextSteep.SETUP;

    when( context:PostgresContext, steep:PostgresContextSteep ): boolean {
        return context.installerLocation === InstallationLocation.LOCAL
            && os.platform() === "win32";
    }

    flow(context:PostgresContext, steep:PostgresContextSteep, preview:SteepFlow<PostgresContext, any, PostgresContextSteep>, flow:Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        return new Promise( resolve => {
            this.getInstallation( context,(installation, error) => {
                if( error ){
                    return resolve({
                        error: error,
                        flow: OutFlow.BREAK,
                        response: {
                            message: `SETUP ERROR | Error =  "${ error.message }"`
                        }
                    })
                }

                if( !installation ){
                    return resolve({
                        error: null,
                        flow: OutFlow.BREAK,
                        response: {
                            message: `Postgres installation not found!`
                        }
                    });
                }

                System.toPath( Path.join( installation.installation, "bin") )
                let listen = ProcessListen.spawn( "pg_ctl", [ "--version" ] );
                listen.on( "finally", ( result, error) => {
                    if( error ){
                        return resolve({
                            error: error,
                            flow: OutFlow.BREAK,
                            response: {
                                message: `SETUP ERROR | Invalid postgres installation | Error = "${ error.message }"`
                            }
                        })
                    }

                    if( result.code !== 0 ){
                        return resolve({
                            flow: OutFlow.BREAK,
                            response: {
                                message: `SETUP ERROR | Invalid postgres installation | Message = "${ Buffer.concat( result.output ).toString().trim() }"`
                            }
                        })
                    }

                    context.installation = installation;
                    context.installationBin = installation.installation;

                    return resolve({
                        flow: OutFlow.CONTINUE,
                        response: {
                            message: `SETUP OK | Running with postgres version = "${Buffer.concat( result.output ).toString().trim()}" Message = "${ installation.message }"`
                        }
                    })
                })
            })
        });
    }

    getInstallation( context:PostgresContext, response:( installation:PgInstallation&{ message:string }, error?:Error )=>void){
        let currentVersion = ()=>{
            if( !fs.existsSync( Path.join( context.base, "PG_VERSION" ) ) ) return { message: "Working with last found version!" }
            let content = fs.readFileSync( Path.join( context.base, "PG_VERSION" ) ).toString().trim();
            let version = Number( content );
            let message = `Working with version found in cluster!`

            if( Number.isNaN( version) || !Number.isFinite( version ) || !Number.isSafeInteger( version ) ) return { message: "Invalid Version Number"};
            return { version, message };
        }
        let { version , message } = currentVersion();
        if( version && context.options.target && version !== context.options.target ){
            return response( null, new Error(`Found cluster cluster version is smaller than target version! ClusterVersion = ${ version } MinVersion = ${ context.options.target } Cluster = ${ context.base }`));
        }
        if( version && context.options.minVersion && version < context.options.minVersion ){
            return response( null, new Error( `Found cluster version is smaller than minVersionConfigs! ClusterVersion = ${ version } MinVersion = ${ context.options.minVersion } Cluster = ${ context.base }`))
        }

        lookupPostgresRegister(( result, error)=>{
            if( error ) return response( null, error );
            let _minVersion = context.options.minVersion || result.maxVersion;
            let bestVersion:PgInstallation;

            if( !bestVersion && !! version ) bestVersion = result.installations.find( next =>  next.versionNumber === version );
            if( !bestVersion && !! context.options.target ) bestVersion = result.installations.find( next =>  next.versionNumber === context.options.target );
            if( !bestVersion && !! context.options.minVersion ) bestVersion = result.installations.find( next => {
                return next.versionNumber >= _minVersion
                    && next.versionNumber === result.maxVersion;
            });

            if( !bestVersion ) bestVersion = result.installations.find( next =>  {
                return next.versionNumber === result.maxVersion
            });

            if( !bestVersion ) return response( null, new Error( `No best version installation founds!`));

            response( Object.assign( bestVersion as any, { message }) )
        });
    }
}
export const _RecognizeFlow = new RecognizeFlow();