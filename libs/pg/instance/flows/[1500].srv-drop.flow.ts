import {Flow, FlowResponse, OutFlow, SteepFlow} from "kitres";
import {DBFlowResponse, InstallationLocation, PostgresContext, PostgresContextSteep} from "../index";

class SrvCreateFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep> {
    readonly steeps: PostgresContextSteep = PostgresContextSteep.SRV_DROP;
    identifier = PostgresContextSteep.SRV_DROP;

    when( context:PostgresContext, steep:PostgresContextSteep): boolean {
        return context.clusterLocation === InstallationLocation.LOCAL
            && context.checkBadCluster
            && context.check.cluster.status === "NotFound"
            && (context.check.service === "Stooped" || context.check.service === "Running")

            ;
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
            context.elevator.child.once("dropService", (opts1,  createService) => {
                if( !createService.result ) return resolve({
                    error: null,
                    flow: OutFlow.BREAK,
                    response:{
                        message: `Falhao ao eliminar o serviço! Message = "${ createService.message }"`,
                    }
                });

                return resolve({
                    error:null,
                    flow:OutFlow.CONTINUE,
                    response:{
                        message: `Serviço do banco de dados "${ context.options.service}" eliminado com sucesso!`,
                    },
                });
            });
            context.elevator.send( "dropService",  {
                service: context.options.service,
                directory: context.base
            })
        });
    }
}

export const _SrvCreateFlow = new SrvCreateFlow();