import {Flow, FlowResponse, LogLevel, OutFlow, SteepFlow} from "kitres";
import {DBFlowResponse, PostgresContext, PostgresContextSteep} from "../index";
import {ProcessListen} from "kitres/src/core/util/process";
import {spawn} from "child_process";

class DbDatabaseImportFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep> {


    readonly identifier: PostgresContextSteep.DB_DATABASE_IMPORT;
    readonly steeps: PostgresContextSteep = PostgresContextSteep.DB_DATABASE_IMPORT;

    when(context:PostgresContext, steep:PostgresContextSteep): boolean {
        console.log( this, context.check.database.news );
        return context.check.database.news.filter(value => !!value.base).length > 0;
    }

    flow(context:PostgresContext, steep:PostgresContextSteep, preview:SteepFlow<PostgresContext, any, PostgresContextSteep>, flow:Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        return context.check.database.news.map((database, index) => {
            return ()=>{
                return new Promise( (resolve, reject) => {
                    let user = context.users.find( (_user)=>{
                        return _user.username === database.owner;
                    });

                    if( !user ){
                        return resolve({
                            flow:OutFlow.BREAK,
                            response: {
                                message: `Owner user "${ database.owner }" for database "${ database.dbname }" not found in users list!`
                            }
                        })
                    }

                    let child = new ProcessListen( spawn( context.psql(), [
                        "-h", context.serverHost,
                        "-p", `${ context.port }`,
                        "-U", database.owner,
                        "-d", database.dbname,
                        "-f", database.base,
                    ], {
                        env:{ PGPASSWORD: user.password }
                    }));

                    child.on( "stdout", buffer => {
                        context.notify( "log", LogLevel.Info, buffer.toString() );
                    });

                    child.on( "stderr", buffer => {
                        context.notify( "log", LogLevel.Info, buffer.toString() );
                    });

                    child.on( "finally",(result, error) => {
                        if( error ) {
                            return resolve({
                                error: error,
                                flow: OutFlow.BREAK,
                                response: {
                                    message: error.message
                                }
                            })
                        }

                        if( result.code !== 0 ){
                            return resolve({
                                error: null,
                                flow: OutFlow.BREAK,
                                response: {
                                    message: Buffer.concat(result.output).toString()
                                }
                            })
                        }

                        return  resolve({
                            flow: OutFlow.CONTINUE,
                            response:{
                                message: `Database file ${ new URL( `file://${database.base}`).href } imported successfully to "${database.dbname}"`
                            }
                        })
                    });

                })
            }
        })
    }
}

export const _DbDatabaseImportFlow = new DbDatabaseImportFlow();