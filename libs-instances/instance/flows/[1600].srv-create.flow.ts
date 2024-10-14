import {Flow, FlowResponse, OutFlow, SteepFlow} from "kitres";
import {DBFlowResponse, InstallationLocation, PostgresContext, PostgresContextSteep} from "../index";


export class SrvCreateFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>{
    steeps = PostgresContextSteep.SRV_CREATE;
    identifier = PostgresContextSteep.SRV_CREATE

    when(  context:PostgresContext, steep:PostgresContextSteep): boolean {

        return context.clusterLocation === InstallationLocation.LOCAL
            && ((
                context.checkBadCluster
                && context.check.cluster.status === "NotFound"
            ) || context.check.service === "NotFound")
    }

    flow( context:PostgresContext, steep:PostgresContextSteep, preview:SteepFlow<PostgresContext, any, PostgresContextSteep>, flow:Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        return new Promise( resolve => {
            if( !context.service ){
                return resolve({
                    flow: OutFlow.BREAK,
                    response: {
                        message: `Service name is not declared!`
                    }
                });
            }

            context.elevator.child.once("createService", (opts1, createService) => {
                if( !createService.result ) return resolve({
                    error: null,
                    flow: OutFlow.BREAK,
                    response:{
                        message: `Falhao ao criar o serviço! Message = "${ createService.message }"`,
                    }
                });

                return resolve({
                    error:null,
                    flow:OutFlow.CONTINUE,
                    response:{
                        message: `Serviço do banco de dados "${ context.options.service}" criado com sucesso!`,
                    },
                });
            });
            context.elevator.send( "createService",  {
                service: context.options.service,
                directory: context.base
            })
        });
    }
}

export const _SrvCreateFlow = new SrvCreateFlow();