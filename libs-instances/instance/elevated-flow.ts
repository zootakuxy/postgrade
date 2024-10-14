import {IpcPostgresInstanceEvent} from "./ipc-instance";
import {checkClusterStatus} from "./flows/_check";
import { ElevateChild } from "kitres/src/core/system/elevate";
import { System } from "kitres/src/core/system";
import { errorUtil } from "kitres";
import {PgCtl} from "../pg-ctl";

export function main( child:ElevateChild<IpcPostgresInstanceEvent> ){
    child.on( "checkVerbose", (opts) => {
        checkClusterStatus( opts, (error, response) => {
            if( error ) return child.send("checkVerbose", opts, {
                errorMessage: error.message,
                errorStack: error.stack,
                service: "ERROR",
                connection:[],
                cluster:{
                    status:"ERROR"
                }, status: "ERROR",
                failures:["CLUSTER"],
                badConnections: [],
            })
            return child.send( "checkVerbose", opts, response );
        })
    });

    child.on( "init", (opts) => {
        let initChild = PgCtl.initdb( opts, (error, result) => {
            if( error ){
                return child.send( "init", opts, errorUtil.serialize( error ), result );
            }

            return child.send( "init", opts, error, result );
        });

        initChild.on( "stderr", buffer => {
            child.send( "initMessage", buffer.toString() );
        });

        initChild.on( "stdout", buffer => {
            child.send( "initMessage", buffer.toString() );
        });
    });

    child.on( "configFiles", configs => {
        try{
            const {____ConfFileFlow} = require("./flows/[1700].conf-file.flow" );
            ____ConfFileFlow.configs(configs );
            child.send( "configFiles", configs );
        } catch (error){
            child.send( "configFiles", configs, errorUtil.serialize( error as Error ) );
        }
    });

    child.on( "createService", opts => {
        PgCtl.register( opts, (error, response) => {
            if( error ){
                child.send( "createService", opts, {
                    ...(response||{}),
                    message: `Error | ${ error.message }`,
                    output: Buffer.from( error.stack ),
                    result: false
                });
            }
            child.send( "createService", opts, response );
        });
    });

    child.on( "dropService", opts => {
        PgCtl.unregister( opts, (error, response) => {
            if( error ){
                child.send( "dropService", opts, {
                    ...(response||{}),
                    message: `Error | ${ error.message }`,
                    output: Buffer.from( error.stack ),
                    result: false
                });
            }
            child.send( "dropService", opts, response );
        });
    });

    child.on( "restartService", (service) => {
        System.stopService( service, (error, result) => {
            System.startService( service, (error, response) => {
                if( error ){
                    return child.send( "restartService", service, {
                        ...(response||{}),
                        result: false,
                        message: `Error| ${ error.message }`,
                        output: Buffer.from( error.stack ),
                    })
                }

                child.send( "restartService", service, response );
            })
        });
    })

    child.on( "startService", (service) => {
        System.startService( service, (error, response) => {
            if( error ){
                return child.send( "startService", service, {
                    ...(response||{}),
                    result: false,
                    message: `Error| ${ error.message }`,
                    output: Buffer.from( error.stack ),
                })
            }

            child.send( "startService", service, response );
        })
    })

    child.on( "stopService", (service) => {
        System.stopService( service, (error, response) => {
            if( error ){
                return child.send( "stopService", service, {
                    ...(response||{}),
                    result: false,
                    message: `Error| ${ error.message }`,
                    output: Buffer.from( error.stack ),
                })
            }
            child.send( "stopService", service, response );
        });
    })
}