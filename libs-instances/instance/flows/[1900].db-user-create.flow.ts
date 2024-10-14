import {Flow, FlowResponse, LogLevel, OutFlow, SQL, sql, SteepFlow} from "kitres";
import {DBFlowResponse, PostgresContext, PostgresContextSteep} from "../index";
import { QueryError } from "kitres/src/core/database/pg-core/query-executor";

class DbUserCreateFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>{

    readonly steeps: PostgresContextSteep = PostgresContextSteep.DB_USER_CREATE;
    identifier = PostgresContextSteep.DB_USER_CREATE;

    when(context:PostgresContext, steep:PostgresContextSteep): boolean {
        return true;
        // return check.cluster.status === "NotFound"
        //     || check.badConnections.length > 0
    }



    flow(context:PostgresContext, steep:PostgresContextSteep, preview:SteepFlow<PostgresContext, any, PostgresContextSteep>, flow:Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        let self = this;
        let _users = context.options.configs.users;


        return new Promise( resolve => {


            context.superuser.core.query<{usename:string},any>( sql`select * from pg_user where usename = any( ${ SQL.varchar (_users.map( _usr => _usr.username ))} )`, {
                onNotice(error, message) {
                    if( error ) return;
                    context.notify("log", LogLevel.Info, message );
                },
                onResult(error: QueryError, result?) {
                    if( error ) return resolve({
                        error: error,
                        flow: OutFlow.BREAK,
                        response: {
                            message: `Error ao verificar utilizador existentes! Error = "${ error.message }"`
                        }
                    });

                    let _news = context.users.filter( value => {
                        let find = result.rows.find( value1 => value1.usename === value.username );
                        return !find;
                    });

                    if( !context.check.users ) context.check.users = {};
                    context.check.users.news = _news;

                    let query = _users.map( usr => {
                        let replication = "";
                        let superuser = "";

                        if( usr.replication ) replication = "replication";
                        if( usr.superuser ) superuser = "superuser";
                        let find = result.rows.find( value1 => value1.usename === usr.username );
                        if( find ) return sql`alter user ${ SQL.identifier( usr.username ) } with password ${ SQL.literal( usr.password ) } ${ SQL.keyword( replication ) } ${ SQL.keyword( superuser )}`;
                        else return sql`create user ${ SQL.identifier( usr.username ) } with password ${ SQL.literal(usr.password) } ${ SQL.keyword( replication ) } ${ SQL.keyword( superuser )}`;
                    });

                    let builder = query.shift();
                    if(builder && query.length ) builder.push( ...query );

                    if( !builder ){
                        return resolve({
                            error: null,
                            flow: OutFlow.CONTINUE,
                            response:{
                                message: `Nenhum utilizador para ser configurado!`
                            }
                        })
                    }

                    context.superuser.core.execute( builder, {
                        onNotice(error, message) {
                            if( error ) return;
                            context.notify("log", LogLevel.Info, message );
                        },
                        onResult(error, result?) {
                            if( error )return resolve({
                                error: error,
                                flow: OutFlow.BREAK,
                                response: {
                                    message: `Erro ao criar os utilizadores! Error = "${error.message}"`
                                }
                            });

                            return resolve({
                                error: null,
                                flow: OutFlow.CONTINUE,
                                response: {
                                    message: `Todos os utilizadore configurados com sucesso!`
                                }
                            })
                        }
                    });
                }
            })
        });
    }
}

export const _ConfUsersCreateFlow = new DbUserCreateFlow();
