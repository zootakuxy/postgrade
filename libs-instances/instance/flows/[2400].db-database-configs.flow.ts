import {Flow, FlowResponse, LogLevel, OutFlow, QueryBuilderResult, SQL, sql, SteepFlow} from "kitres";
import {DBFlowResponse, PostgresContext, PostgresContextSteep} from "../index";
import escape from "pg-escape";
import {grantOnExpressionTo, grantsAllOnDatabaseTo, grantsAllOnSchemaTo} from "../grants";


//PostgresInstance, PostgresInstanceFlowResponse, FlowActions
class DbDatabaseConfigsFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>{
    identifier = "CONFIG_DATABASE_LABEL";
    steeps: PostgresContextSteep = PostgresContextSteep.DB_DATABASE_CONFIG;

    when(context:PostgresContext, steep:PostgresContextSteep): boolean {
        return true;
    }

    flow( context:PostgresContext, steep:PostgresContextSteep, preview:SteepFlow<PostgresContext, any, PostgresContextSteep>, flow:Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        return context.database.map( database => {
            return () => {
                return new Promise( resolve => {
                    if( !database.schemas ) database.schemas = [];
                    if( !database.grants ) database.grants = [];

                    let needConfigs= database.search.filter(value => !!value && value.length ).length
                        || database.schemas.filter(value => !!value && value.length ).length
                        || database.grants.filter(value => !!value && value.expression?.length ).length
                    ;
                    if( !needConfigs ) return resolve({
                        flow: OutFlow.CONTINUE,
                        response: {
                            message: `Nehuma configuração necessaria para o banco de dados ${ database.dbname }`,
                        }
                    });

                    let queries:QueryBuilderResult[] = [];


                    if( database.schemas?.length>0){
                        queries.push( ...database.schemas.map( schema => {
                            return sql`create schema if not exists ${ SQL.identifier( schema )};`
                        }))
                        queries.push( ...database.schemas.map( schema => {
                            return sql`alter schema ${SQL.identifier( schema ) } owner to ${ SQL.identifier( database.owner )}`
                        }))
                        database.search.forEach(schema => {
                            queries.push( ...grantsAllOnSchemaTo( schema, database.owner ))
                        })
                    }

                    if( database.search?.length > 0 ){
                        let _search = database.search.map(value => escape.ident( value ) ).join(", ");
                        queries.push( sql`alter database ${ SQL.identifier( database.dbname ) } set search_path to ${ SQL.unsafe( _search ) }`)
                    }

                    //Quando houver novas extensions dar previlegios
                    if( database.newExtensions.length ){
                        let extensionSchema:string = database.extensionSchema || "public";
                        queries.push( ... grantsAllOnSchemaTo( extensionSchema, database.owner ))
                    }

                    queries.push( ... grantsAllOnDatabaseTo( database.dbname, database.owner ) );
                    queries.push( ... grantOnExpressionTo( database ) );

                    let builder = sql.join( queries );
                    let connection = context.superTo( database.dbname );
                    connection.core.execute( builder, {
                        onNotice(error, message) {
                            if( error ) return;
                            context.notify("log", LogLevel.Info, message );
                        },
                        onResult( error, result ) {
                            if( error ){
                                return resolve({
                                    flow: OutFlow.BREAK,
                                    error: error,
                                    response: {
                                        message: `Error when configuring database "${ database.dbname }"! Error = "${error.message}"`,
                                    }
                                });
                            }

                            resolve({
                                flow: OutFlow.CONTINUE,
                                response:{
                                    message: `Banco de dados ${ database.dbname } configurado com sucesso!`,
                                }
                            })
                        }
                    })
                });
            }
        });
    }
}
export const _DbDatabaseConfigsFlow = new DbDatabaseConfigsFlow();