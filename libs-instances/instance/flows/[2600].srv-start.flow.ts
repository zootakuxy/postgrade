import {Flow, FlowResponse, OutFlow, SteepFlow} from "kitres";
import {DBFlowResponse, InstallationLocation, PostgresContext, PostgresContextSteep} from "../index";
class SrvStartFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>{
    readonly steeps: PostgresContextSteep = PostgresContextSteep.SRV_START;
    readonly identifier = PostgresContextSteep.SRV_START;

    when(context:PostgresContext, steep:PostgresContextSteep): boolean {
        return context.clusterLocation === InstallationLocation.LOCAL
            // && ( context.check.cluster.status === "Stooped" || context.check.cluster.status === "Running" )
            && context.check.service === "Stooped"
            ;
    }

    flow(context:PostgresContext, steep:PostgresContextSteep, preview:SteepFlow<PostgresContext, any, PostgresContextSteep>, flow:Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        return new Promise( resolve => {
            if( !context.service ){
                return resolve({
                    flow: OutFlow.BREAK,
                    response: {
                        message: `Service name is not declared!`
                    }
                });
            }
            context.elevator.child.once("startService", (service, startService) => {

                if( !startService.result ) return resolve({
                    flow:OutFlow.BREAK,
                    response: {
                        message: `Falha ao reiniciar o serviço do banco de dados! Message = "${startService.message}"`,
                    }
                });

                return resolve({
                    flow: OutFlow.CONTINUE,
                    response:{
                        message: `Serviço de banco de dados "${ context.service }" inicializado com sucesso!`,
                    }
                });
            });

            context.elevator.send("startService" , context.service );
        });
    }
}

export const _SrvStartFlow = new SrvStartFlow();