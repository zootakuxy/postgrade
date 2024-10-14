import {errorUtil, Flow, FlowResponse, OutFlow, SteepFlow} from "kitres";
import {
    DBFlowResponse,
    InstallationLocation,
    PostgresContext,
    PostgresContextSteep,
    PostgresInstanceOptions
} from "../index";
import Path from "path";
import fs from "fs";
import ini from "ini";

/*
# TYPE          DATABASE        USER            ADDRESS                 METHOD
# local         DATABASE        USER                                    METHOD  [OPTIONS]
# host          DATABASE        USER            ADDRESS                 METHOD  [OPTIONS]
# hostssl       DATABASE        USER            ADDRESS                 METHOD  [OPTIONS]
# hostnossl     DATABASE        USER            ADDRESS                 METHOD  [OPTIONS]
# hostgssenc    DATABASE        USER            ADDRESS                 METHOD  [OPTIONS]
# hostnogssenc  DATABASE        USER            ADDRESS                 METHOD  [OPTIONS]
 */





class ConfFileFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>{
    identifier: string = PostgresContextSteep.CONF_FILE;
    steeps:  PostgresContextSteep = PostgresContextSteep.CONF_FILE;

    when(context:PostgresContext, steep:PostgresContextSteep): boolean {
        return context.clusterLocation === InstallationLocation.LOCAL
            && context.checkBadCluster
            && (context.check.cluster.status === "NotFound"
            || context.check.badConnections.length > 0
            || context.check.cluster.status === "Stooped")
    }

    flow( context:PostgresContext, steep:PostgresContextSteep, preview:SteepFlow<PostgresContext, any, PostgresContextSteep>, flow:Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        return new Promise( resolve => {

            if( !context.options.configs.port ){
                return resolve({
                    flow: OutFlow.BREAK,
                    response: {
                        message: `Required port is not defined!`
                    }
                })
            }

            context.elevator.child.once("configFiles", (options, error ) => {
                if( error ){
                    error = errorUtil.parse( error );
                    return resolve({
                        flow: OutFlow.BREAK,
                        error: error,
                        response: {
                            message: `Failed to configure cluster files! Error = "${ error.message }"`
                        }
                    })
                }
                context.options = options;

                resolve({
                    flow: OutFlow.CONTINUE,
                    error: null,
                    response: {
                        message: `Cluster files configured with success`,
                    }
                })
            });
            context.elevator.send( "configFiles", context.options );
        });
    }



    configs( opts:PostgresInstanceOptions ){

        let content = fs.readFileSync( Path.join( opts.cluster, "postgresql.conf" ) ).toString();
        let configs = ini.parse( content );
        let configLines:string[] = [];
        if( !configs["port"]
            || Number(configs[ "port" ]) !== opts.configs.port
        ) configLines.push( `port = ${ opts.configs.port }` );

        if( opts.configs.listenAddress && (
            !configs["listen_addresses"]
            || configs[ "listen_addresses" ] !== `'${ opts.configs.listenAddress }'`
        )) configLines.push( `listen_addresses = '${ opts.configs.listenAddress }'` );

        let update = ( filename:string )=>{
            if( configLines.length ){
                let scripts  = `
                ${ content }
                #=================== ${ new Date().toISOString() } ==================
                ${ configLines.join("\n")}
                #===================                               ==================
                `.split( "\n" )
                    .map( value => value.trim() )
                    .filter( value => value.length )
                    .join( "\n" )
                ;
                fs.writeFileSync( Path.join( opts.cluster,filename ), scripts, );
            }
        }

        update( "postgresql.conf" );
        configLines.length = 0;

        content = fs.readFileSync( Path.join( opts.cluster, "pg_hba.conf" ) ).toString();
        let hba = content.split("\n")
            .filter( value => !value.trim().startsWith( "#" ) )
            .map( value => {
                let parts = value.split( " " )
                    .map( value1 => value1.trim() )
                    .filter( value1 => value1.length );
                if(!["local", "host"].includes( parts[0]) )  return null;
                if( parts[0] === "local" && parts.length !== 4) return null;
                if( parts[0] === "host" && parts.length !== 5) return null;
                let TYPE:string, DATABASE:string, USER:string, ADDRESS:string, METHOD:string;

                if( parts[0] === "local" ){
                    [ TYPE, DATABASE, USER, METHOD ] =parts;
                } else if( parts[0] === "host"){
                    [ TYPE, DATABASE, USER, ADDRESS, METHOD ] =parts;
                }

                if( !TYPE ) return null;
                if( !DATABASE) return null;
                if( !USER) return  null;
                if( !METHOD) return null;

                return  {
                    TYPE, DATABASE, USER, ADDRESS, METHOD
                }
            }).filter( value => {
                return !!value;
            });

        opts.configs.hba.forEach( value => {
            if ( value.address === "*" ) value.address = "0.0.0.0/0";
        })

        opts.configs.hba.filter( news => {
            if( news.address === "*" ) news.address = "0.0.0.0/0";
            let find = hba.find( current => {
                return current.TYPE === news.type
                    && current.DATABASE === news.database
                    && current.USER === news.user
                    && current.METHOD === news.method
                    && (current.ADDRESS === news.address || (!current.ADDRESS && !news.address))
            });
            return !find;
        }).forEach( value => {
            //# TYPE  DATABASE        USER            ADDRESS                 METHOD
            configLines.push( `${value.type }    ${ value.database }    ${ value.user }    ${ value.address?value.address:"" }    ${ value.method }` );
        });

        update( "pg_hba.conf" );
    }
}
export const ____ConfFileFlow = new ConfFileFlow();