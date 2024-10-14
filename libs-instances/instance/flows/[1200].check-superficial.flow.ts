import {checkClusterStatus, CheckResult, CheckStatus} from "./_check";
import {Flow, FlowResponse, OutFlow, SteepFlow} from "kitres";
import {DBFlowResponse, InstallationLocation, PostgresContext, PostgresContextSteep} from "../index";


class CheckSuperficialFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep> {
    identifier: string = PostgresContextSteep.FLOW_CHECK_PRE;
    steeps = PostgresContextSteep.FLOW_CHECK_PRE;

    when(): boolean {
        return true
    }
    flow( context: PostgresContext, steep: PostgresContextSteep, preview: SteepFlow<PostgresContext, any, PostgresContextSteep>, flow: Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        return new Promise( resolve => {
            let opts:CheckStatus = {
                service: context.options.service,
                port: context.options.configs.port,
                directory: context.base,
                connections: context.connections,
                clusterLocation: context.clusterLocation,
                installerLocation: context.installerLocation,
                mode:"superficial"
            }

            checkClusterStatus( opts, (error1, response) => {
                context.check = response;
                if( error1 ){
                    return resolve({
                        error: null,
                        flow: OutFlow.CONTINUE,
                        message: `Perliminar, Falha nos teste de connexão! | Error = ${ error1?.message }`
                    });
                }

                return resolve({
                    error: null,
                    flow: OutFlow.CONTINUE,
                    message: "Check preliminar OK! Tudo funcionando como esperado"
                });
            });
        })
    }
}

export const _CheckSuperficialFlow = new CheckSuperficialFlow();