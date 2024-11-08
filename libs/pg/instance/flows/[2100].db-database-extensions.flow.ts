import {Flow, FlowResponse, OutFlow, SQL, sql, SteepFlow} from "kitres";
import {DBFlowResponse, PostgresContext, PostgresContextSteep} from "../index";

//PostgresInstance, PostgresInstanceFlowResponse, FlowActions
class DbDatabaseExtensionsFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>{
    identifier = PostgresContextSteep.DB_DATABASE_EXTENSIONS;
    steeps: PostgresContextSteep = PostgresContextSteep.DB_DATABASE_EXTENSIONS;

    when(context:PostgresContext, steep:PostgresContextSteep): boolean {
        return context.database.filter( value => value.extensions.length ).length > 0;
    }

    flow(context:PostgresContext, steep:PostgresContextSteep, preview:SteepFlow<PostgresContext, any, PostgresContextSteep>, flow:Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        return context.database.map( database => {
            return () => {
                return new Promise( response => {
                    if( !database.extensions?.length ) return response({
                        flow: OutFlow.CONTINUE,
                        response: {
                            message: `Nenhuma extensão para ser configurada ${ database.dbname }! Continuar`,
                        }
                    });
                    let connection = context.superTo( database.dbname );
                    let schema:string = database.extensionSchema||"public"
                    connection.core.query<{extname:string},any>( sql`select  * from pg_extension where extname = any ( ${SQL.varchar( database.extensions.map( ext => ext ))})`, (error, res) => {
                        if( error ){
                            return response({
                                flow: OutFlow.BREAK,
                                error: error,
                                response: {
                                    message: `Error when check extensions! Error = "${error.message}"`
                                }
                            });
                        }

                        database.newExtensions = database.extensions.filter( extensionName =>   {
                            return !res.rows.find( value => value.extname === extensionName )
                        });


                        if( !database.newExtensions.length ){
                            return response({
                                flow: OutFlow.CONTINUE,
                                response: {
                                    message: `All extensions as configured!`
                                }
                            });
                        }

                        let queries = database.newExtensions.map( extension => {
                            return sql`create extension if not exists ${ SQL.identifier( extension )} with schema ${ SQL.identifier( schema )}`
                        });

                        queries.unshift( sql`create schema if not exists ${SQL.identifier( schema )};`)

                        let query = sql.join( queries );
                        connection.core.execute( query, {
                            onResult(error, res ) {
                                if( error ){
                                    return response({
                                        flow: OutFlow.BREAK,
                                        error: error,
                                        response: {
                                            message: `Error when check creating extension! Error = "${error.message}"`
                                        }
                                    });
                                }
                                return response({
                                    flow: OutFlow.CONTINUE,
                                    response: {
                                        message: `Extensions ${ database.newExtensions.join( ", ") } configured with successfully!`
                                    }
                                });
                            }
                        })
                    })
                });
            }
        });
    }
}
export const _DbDatabaseExtensionsFlow = new DbDatabaseExtensionsFlow();