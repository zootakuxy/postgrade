import {Flow, FlowResponse, LogLevel, OutFlow, SQL, sql, SteepFlow} from "kitres";
import {DBFlowResponse, PostgresContext, PostgresContextSteep} from "../index";
class DbDatabaseCreateFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>{

    identifier: string = PostgresContextSteep.DB_DATABASE_CREATE;
    steeps: PostgresContextSteep = PostgresContextSteep.DB_DATABASE_CREATE;

    when(context:PostgresContext, steep:PostgresContextSteep): boolean {
        return true;
        //
        // return check.cluster.status === "NotFound"
        //     || check.badConnections.length > 0
        //     ;
    }
    flow(context:PostgresContext, steep:PostgresContextSteep, preview:SteepFlow<PostgresContext, any, PostgresContextSteep>, flow:Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        return new Promise( resolve => {
            context.superuser.core.query<{datname}, any>( sql`select * from pg_database where datname = any(${ SQL.varchar( context.database.map( value => value.dbname ) )})`,{
                    onNotice(error, message) {
                        if( error ) return;
                        context.notify("log", LogLevel.Info, message );
                    },
                    onResult( error, result ) {
                        if( error ) return resolve({
                            error: error,
                            flow: OutFlow.BREAK,
                            response: {
                                message: `Erro ao selecionar utilizadores existente no banco de dados Error = "${ error.message}"`,
                            }
                        });

                        let _news = context.database.filter( value => {
                            let find = result.rows.find( value1 => value1.datname === value.dbname );
                            return !find;
                        });

                        if( !context.check.database ) context.check.database = { };
                        context.check.database.news = _news;
                        if( !_news.length ){
                            return  resolve({
                                error: null,
                                flow: OutFlow.CONTINUE,
                                response: {
                                    message: `Saltar | todos os bancos de dados já foram criados! Nenhuma ação necessaria.`,
                                }
                            })
                        }

                        let queries:Promise<{result:boolean, error?:Error}>[] = _news.map( value =>{
                            let query =  (sql`create database ${ SQL.identifier( value.dbname ) } with owner ${ SQL.identifier( value.owner ) }`);
                            return new Promise( resolve => {
                                context.superuser.core.execute(query, {
                                    onNotice(error, message) {
                                        if( error ) return;
                                        context.notify("log", LogLevel.Info, message );
                                    },
                                    onResult( error, result) {
                                        if( error ){
                                            return resolve({ error: error , result: false })
                                        }
                                        return resolve( { error: null, result: true });
                                    }
                                })
                            });

                        })

                        Promise.all( queries ).then( value => {
                            let failed = value.filter( value1 => value1.error || !value1.result );
                            if( failed.length ){
                                let error = value.find( value1 => value1.error )?.error;
                                return resolve({
                                    error: error,
                                    flow: OutFlow.BREAK,
                                    response: {
                                        message: `Houve erro ao crirar ${ failed.length }/${ _news.length } DATABASE! FirstMessageError = "${error?.message}"`,
                                        faileds: failed
                                    }
                                });
                            }

                            return resolve({
                                error: null,
                                flow: OutFlow.CONTINUE,
                                response: {
                                    message: `${ _news.length } TODOS OS BANCOS DE DADOS CRIADOS COM SUCESSO! Message = (${_news.map( value => value.dbname).join(", ")})`,
                                }
                            })
                        }).catch( reason => {
                            return resolve({
                                error: reason,
                                flow: OutFlow.BREAK,
                                response: {
                                    message: `Erro ao criar o banco de dados Error = "${reason?.message}"`,
                                }
                            });
                        })


                    }
                }
            )

        });
    }
}

export const _DbDatabaseCreateFlow = new DbDatabaseCreateFlow();