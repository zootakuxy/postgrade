import {Flow, FlowResponse, OutFlow, SteepFlow} from "kitres";
import {DBFlowResponse, InstallationLocation, PostgresContext, PostgresContextSteep} from "../index";


class SrvRestartFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>{
    readonly steeps: PostgresContextSteep = PostgresContextSteep.SRV_RESTART;
    identifier = PostgresContextSteep.SRV_RESTART;

    when( context:PostgresContext, steep:PostgresContextSteep): boolean {
        return context.clusterLocation === InstallationLocation.LOCAL
            && context.checkBadCluster
            && ( context.check.cluster.status === "NotFound" || context.check.badConnections.length > 0)
    }



    flow(  context:PostgresContext, steep:PostgresContextSteep, preview:SteepFlow<PostgresContext, any, PostgresContextSteep>, flow:Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        return new Promise( resolve => {
            if( !context.service ){
                return resolve({
                    flow: OutFlow.BREAK,
                    response: {
                        message: `Service name is not declared!`
                    }
                });
            }
            context.elevator.child.once("restartService", (service, restartService) => {
                if( !restartService.result ) return resolve({
                    error: null,
                    flow: OutFlow.BREAK,
                    response: {
                        message: `Falha ao reniciar o serviço de banco de dados! Message = "${restartService.message}"`,
                    }
                });

                return resolve({
                    error: null,
                    flow: OutFlow.CONTINUE,
                    response: {
                        message: `Serviço de banco de dados ${ context.options.service } reinicializado com sucesso!`,
                    }
                });

            });
            context.elevator.send("restartService" , context.options.service );
        });
    }
}

export const _SrvRestartFlow = new SrvRestartFlow();
