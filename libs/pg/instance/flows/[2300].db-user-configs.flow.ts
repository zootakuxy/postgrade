import {Flow, FlowResponse, LogLevel, OutFlow, SQL, sql, SteepFlow} from "kitres";
import {DBFlowResponse, PostgresContext, PostgresContextSteep} from "../index";
import escape from "pg-escape";

export class DbUserConfigsFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>{
    readonly steeps: PostgresContextSteep = PostgresContextSteep.DB_USER_CONFIGS;
    identifier = PostgresContextSteep.DB_USER_CONFIGS;

    when(context:PostgresContext, steep:PostgresContextSteep): boolean {
        return true;
        // return check.cluster.status === "NotFound"
        //     || check.badConnections.length > 0
        //     ;
    }

    flow(context:PostgresContext, steep:PostgresContextSteep, preview:SteepFlow<PostgresContext, any, PostgresContextSteep>, flow:Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        let self = this;
        return new Promise( resolve => {
            let queries = context.users.map( value => {
                if( !value.search || !value.search.length ) return;
                let _search:string = value.search
                    .filter( value1 => !!value1 )
                    .map( (value1, index) => {
                        return escape.ident( value1 );
                    })
                    .join( ", " );
                if( !_search || !_search.length ) return;
                return sql`alter user ${ SQL.identifier( value.username ) } set search_path to ${ SQL.unsafe( _search ) };`;
            }).filter( value1 => !!value1 && value1 )

            let builder = queries.shift();
            if( queries.length && builder ) builder.push( ...queries );
            if( !builder ){
                return resolve({
                    error: null,
                    flow: OutFlow.CONTINUE,
                    response: {
                        message: "Saltar configuração do search path! Nenhum utilizador para configurar o search path!",
                    }
                })
            }

            context.superuser.core.execute( builder, {
                onNotice(error, message) {
                    if( error ) return;
                    context.notify("log", LogLevel.Info, message );
                },
                onResult(error, result) {
                    if( error ){
                        return resolve ({
                            error: error,
                            flow: OutFlow.BREAK,
                            response: {
                                message: `Erro ao configurar o search path dos utilizadoeres: Error = "${ error.message}"`
                            }
                        });
                    }

                    resolve({
                        error: null,
                        flow: OutFlow.CONTINUE,
                        response: {
                            message: "SearchPatch dos utilizadores confifurados com sucesso!",
                        }
                    })
                }
            })
        });
    }
}

export const _DbUserConfigsFlow = new DbUserConfigsFlow();