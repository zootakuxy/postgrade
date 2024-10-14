import {Flow, FlowResponse, LogLevel, OutFlow, SteepFlow} from "kitres";
import {Database, DBFlowResponse, PgUser, PostgresContext, PostgresContextSteep} from "../index";
import {ProcessListen} from "kitres/src/core/util/process";
import {spawn} from "child_process";

class DbDatabaseSetupFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep> {


    readonly identifier: PostgresContextSteep.DB_DATABASE_SETUP;
    readonly steeps: PostgresContextSteep = PostgresContextSteep.DB_DATABASE_SETUP;

    when(context:PostgresContext, steep:PostgresContextSteep): boolean {
        return context.check.database.news.filter( value => !!value.base ).length > 0;
    }

    flow(context:PostgresContext, steep:PostgresContextSteep, preview:SteepFlow<PostgresContext, any, PostgresContextSteep>, flow:Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        let setups:(Database&{ user: PgUser, filename:string, critical:boolean })[] = [];
        context.check.database.news.forEach( database => {
            if( !database.setups ) return;
            database.setups.forEach( setup => {
                let user:PgUser;
                if( setup.superuser ) user = context.options.superuser;
                else user = context.users.find( value => value.username === setup.user );

                setups.push( {
                    ...database,
                    critical: !setup.noCritical,
                    user: user,
                    filename: setup.filename
                })
            })
        });

        if( !setups.length ){
            return {
                flow: OutFlow.CONTINUE,
                response: {
                    message: "Nenhum banco de dadas para para ser preparado"
                }
            }
        }

        return setups.map( setup => {
            return ()=>{
                return new Promise( resolve => {

                    if( !setup.user ) return resolve({
                        error:null,
                        flow: OutFlow.BREAK,
                        response: {
                            message: `User for setup database ${ setup.dbname } with file ${ new URL( `file://${setup.filename }`).href } not found in configs file!`
                        }
                    })

                    let child = new ProcessListen(spawn( context.psql(), [
                        "-h", context.serverHost,
                        "-p", `${ context.port }`,
                        "-U", setup.user.username,
                        "-d", setup.dbname,
                        "-f", setup.filename,
                    ], {
                        env:{
                            PGPASSWORD: setup.user?.password
                        }
                    }));

                    child.on( "stdout", buffer => {
                        context.notify( "log", LogLevel.Info, buffer.toString() );
                    });

                    child.on( "stderr", buffer => {
                        context.notify( "log", LogLevel.Info, buffer.toString() );
                    });

                    child.on( "finally",(result, error) => {
                        let success = !error && result.code === 0;
                        if( error && setup.critical ) {
                            return resolve({
                                error: error,
                                flow: OutFlow.BREAK,
                                response: {
                                    message: error.message
                                }
                            })
                        }

                        if( result.code !== 0 && setup.critical ){
                            return resolve({
                                error: null,
                                flow: OutFlow.BREAK,
                                response: {
                                    message: Buffer.concat(result.output).toString()
                                }
                            })
                        }

                        if( !success ){
                            return  resolve({
                                flow: OutFlow.CONTINUE,
                                response:{
                                    message: `Database file ${ new URL( `file://${ setup.filename }`).href } import failed! Skip no critical file "${ setup.dbname }"`
                                }
                            })
                        }
                        return  resolve({
                            flow: OutFlow.CONTINUE,
                            response:{
                                message: `Database file ${ new URL( `file://${ setup.filename }`).href } imported successfully to "${ setup.dbname }"`
                            }
                        })
                    });

                })
            }
        })
    }
}

export const _DbDatabaseSetupFlow = new DbDatabaseSetupFlow();