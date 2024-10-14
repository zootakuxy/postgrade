import {Database, InstallationLocation, PgUser} from "../index";
import {ClusterPidStatusResponse, ClusterStatusResponse, PgCtl, ServiceOptions} from "../../pg-ctl";
import {ServiceStatus, System} from "kitres/src/core/system";
import os from "os";



export type CheckResultStatus = "OK"|"FAILED";
export type CheckResult = {
    status:CheckResultStatus|"ERROR"
    errorMessage?:string
    errorStack?:string
    failures:("CLUSTER"|"CONNECTION"|"SERVICE"|"PIDMASTER")[]
    cluster:ClusterStatusResponse,
    database?:{
        news?:Database[]
    }
    users?:{
        news?:PgUser[]
    }
    service?:ServiceStatus|"ERROR",
    connection?:ConnectionTest[]
    pid?:ClusterPidStatusResponse
    badConnections?:ConnectionTest[]
}

export type ConnectionTest = {
    username:string,
    password:string,
    database:string,
    host:string,
    error?:Error,
    status?:boolean,
}

export type CheckStatus = ServiceOptions & {
    connections:ConnectionTest[]
    port: number,
    clusterLocation: InstallationLocation,
    installerLocation: InstallationLocation,
    mode:"superficial"|"verbose"
}

export function checkClusterStatus( opts:CheckStatus, response:( error:Error, response:CheckResult )=>void ){
    let failures: CheckResult["failures"] = [];

        Promise.all( [
            new Promise<{error?:Error, status?:ClusterPidStatusResponse, skip?:boolean}>(( resolve)=>{
                if( os.platform() !== "win32" ){
                    return resolve({ skip: true });
                }

                PgCtl.statusPid( opts ).then( value => {
                    resolve( {
                        error: value.error,
                        status: value.status
                    })
                }).catch( reason => {
                    resolve({ error: reason });
                })
            }),
            new Promise<{ error?:Error, status?:ClusterStatusResponse, skip?:boolean}>( resolve => {
                if( os.platform() !== "win32" ) return resolve({ skip: true });
                if( opts.mode === "verbose" ){
                    return PgCtl.status( opts ).then( value => {
                        resolve(value );
                    })
                }
                resolve({ skip: true })
            }),
            new Promise<{ error?:Error, status?:ServiceStatus, skip?:boolean}>( resolve => {
                if( os.platform() !== "win32" ){
                    return resolve( { skip: true});
                }
                checkServiceStatus( opts, (error1, service) => {
                    resolve({ error:error1, status:service})
                })
            }),
            new Promise<{error:Error, status:ConnectionResponse }>( resolve => {
                checkConnectionStatus(opts, (error, connectionStatus) => {
                    resolve({ error:error, status:connectionStatus })
                })
            }),
        ]).then( ([ pid, cluster, service, connection]) => {
            if( opts.mode === "verbose" ){
                if( cluster.error || !cluster.status || !cluster.status.status ) failures.push( "CLUSTER" );
            }

            (()=>{
                if( pid.skip ) return;
                if( pid.error || !pid.status ) failures.push( "PIDMASTER" );
                else if( pid.status.status !== "Running" ) failures.push( "PIDMASTER" );
            })();

            (()=>{
                if( service.skip ) return;
                if( service.error ) failures.push( "SERVICE" );
                else if( service.status !==  "Running") failures.push( "SERVICE" );
            })();

            (()=>{
                if( connection.error ) failures.push( "CONNECTION" );
                else if( connection.status.badConnections.length > 0 ) failures.push( "CONNECTION" );
            })();

            let error:Error;

            if( opts.mode === "verbose" ) error = cluster.error || pid.error || service.error || connection.error ;
            else if( opts.mode === "superficial" ){
                if( opts.clusterLocation === InstallationLocation.LOCAL ) error = error || pid.error;
                if( opts.clusterLocation === InstallationLocation.LOCAL ) error = error || service.error;
                error = error || connection.error;
            }

            let status:  CheckResultStatus | "ERROR";

            if( opts.mode === "verbose" ) status = failures.length === 0? "OK": "FAILED";
            else if( opts.mode === "superficial" ){
                let superficialError =  failures.includes( "CONNECTION" )
                    || (failures.includes( "PIDMASTER" ) && opts.clusterLocation === InstallationLocation.LOCAL )
                    || (failures.includes( "SERVICE" ) && opts.clusterLocation === InstallationLocation.LOCAL )
                status = !superficialError? "OK": "FAILED";
            }

            response( error , {
                status: status,
                connection: connection.status.connections,
                badConnections: connection.status.badConnections,
                cluster: cluster?.status,
                service: service.status,
                failures: failures,
                pid: pid.status
            })
        })
}


export function checkServiceStatus( opts:CheckStatus, response:( error:Error, service:ServiceStatus )=>void ){
    System.serviceStatus( opts.service, (error1, result1) => {
        response( error1, result1.status );
    })
}


export type ConnectionResponse = {
    connections:ConnectionTest[]
    badConnections:ConnectionTest[],
    message:string
}
export function checkConnectionStatus( opts:CheckStatus, response:( error:Error, response: ConnectionResponse )=>void ){
    let promises:Promise<{
        error?:Error,
        service?: ServiceStatus
        connection?:boolean
        type:"service"|"connection",
        user?:ConnectionTest
    }>[] = [

    ];

    promises.push( ...opts.connections.map((user, index) => {
        return new Promise<{ user:ConnectionTest, connection?:boolean, error?:Error, type:"service"|"connection" }>( resolve => {
            PgCtl.test( {
                port: opts.port,
                host: user.host,
                user: user.username,
                password: user.password,
                database: user.database
            }, (error1, result1) => {
                if( error1 ) return resolve( { user, error: error1, type:"connection" });
                return  resolve( { error: null, connection: result1, type:"connection",
                    user
                });
            });
        });
    }));

    Promise.all( promises ).then( value => {
        let connections:ConnectionTest[] = value.filter(value1 => value1.type === "connection" )
            .map( value1 => {
                return {
                    error: value1.error,
                    status: value1.connection,
                    password: value1.user.password,
                    username: value1.user.username,
                    host: value1.user.host,
                    database: value1.user.database
                }
            });

        let badConnections = connections.filter( value1 => !value1.status || value1.error );
        let message = "";
        if( badConnections.length > 0){
            message = badConnections.map( _bad => {
                return `user = "${_bad.username }" database = "${ _bad.database }" host = "${ _bad.host }" message = "${ _bad.error?.message}"`
            }).join("|");
            message = `Connection  port = ${opts.port } >> ${ message }`;
        } else {
            message = `All user ok!`;
        }

        response( null, {
            badConnections: badConnections,
            connections: connections,
            message: message
        })

    }).catch( reason => {
        response( reason, null );
    });
}
