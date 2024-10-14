import {errorUtil, Flow, FlowResponse, OutFlow, SteepFlow} from "kitres";
import {DBFlowResponse, InstallationLocation, PostgresContext, PostgresContextSteep} from "../index";

export class InitFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>{
    readonly steeps: PostgresContextSteep = PostgresContextSteep.CTL_INIT;
    identifier = PostgresContextSteep.CTL_INIT;

    when(context:PostgresContext, steep:PostgresContextSteep): boolean {
        return context.clusterLocation === InstallationLocation.LOCAL
            && context.checkBadCluster
            && context.check.cluster.status === "NotFound"
            ;
    }


    flow( context:PostgresContext, steep:PostgresContextSteep, preview:SteepFlow<PostgresContext, any, PostgresContextSteep>, flow:Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        return new Promise( resolve => {
            context.elevator.child.once( "init", (opts, error, result) => {
                if( error ){
                    error = errorUtil.serialize( error );
                    let message = "";
                    if( result ) message = `Message = "${result.message}"`;
                    resolve({
                        error: error,
                        flow: OutFlow.BREAK,
                        response: {
                            message: `FAILED TO INITIALIZE THE DATABASE! Error = ${ error.message } ${ message}`.trim()
                        }
                    })
                    return ;
                }

                if( !result.result ){
                    return resolve({
                        flow: OutFlow.BREAK,
                        response: {
                            message: `FAILED TO INITIALIZE THE DATABASE! Message = ${ result?.message }`
                        }
                    })
                }

                return resolve({
                    flow: OutFlow.CONTINUE,
                    response:{
                        message: "Database cluster initialized successfully!"
                    }
                })
            });

            context.elevator.child.on( "initMessage", message => {
                context.notify( "message",  message, "init" )
            });

            context.elevator.send( "init", {
                cli: context.initdb(),
                cliMethod: context.options?.cli?.initdbMethod,
                superuser: context.options.superuser.username,
                password: context.options.superuser.password,
                auth: context.options.init.auth,
                noLocale: context.options.init.noLocale,
                directory: context.base,
                encoding: context.options.init.encoding
            });
        });
    }
}

export const _InitFlow = new InitFlow();
