import {Flow, FlowResponse,  OutFlow, SteepFlow} from "kitres";
import { DBFlowResponse, PostgresContext, PostgresContextSteep} from "../index";

class RootFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>{

    readonly identifier: PostgresContextSteep.FLOW_START;
    readonly steeps = PostgresContextSteep.FLOW_END;

    when(context:PostgresContext, steep:PostgresContextSteep): boolean {
        return true;
    }

    flow( context: PostgresContext, steep: PostgresContextSteep, preview: SteepFlow<PostgresContext, any, PostgresContextSteep>, flow: Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        return {
            flow: OutFlow.FINALLY,
            response: {
                message: "Cluster, Serviços & Bancos de dados configurados com sucesso!",
            }
        }
    }

}

export const _RootFlow = new RootFlow();