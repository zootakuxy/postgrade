import {CheckResult, CheckStatus} from "./_check";
import {Flow, FlowResponse, OutFlow, SteepFlow} from "kitres";
import {DBFlowResponse, InstallationLocation, PostgresContext, PostgresContextSteep} from "../index";

class CheckVerboseFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep> {
    identifier: string = PostgresContextSteep.FLOW_CHECK_VERBOSE;
    steeps = PostgresContextSteep.FLOW_CHECK_VERBOSE;

    when(context:PostgresContext, steep:PostgresContextSteep): boolean {
        return context.clusterLocation === InstallationLocation.LOCAL
            && context.installerLocation === InstallationLocation.LOCAL
            && (!context.check
                || context.check.failures.includes( "SERVICE" )
                || context.check.failures.includes( "CONNECTION" )
                || context.check.failures.includes( "PIDMASTER" )
            )
            ;
    }
    flow(context: PostgresContext, steep: PostgresContextSteep, preview: SteepFlow<PostgresContext, any, PostgresContextSteep>, flow: Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        return new Promise( resolve => {

            let opts:CheckStatus = {
                service: context.options.service,
                port: context.options.configs.port,
                directory: context.base,
                connections: context.connections,
                clusterLocation: context.clusterLocation,
                installerLocation: context.installerLocation,
                mode: "verbose"
            };

            let onCheckResult = (check:CheckResult)=>{
                context.check = check;
                context.checkBadCluster = context.check
                    && check.cluster
                    && check.cluster.status
                    && check.cluster.status !== "Running"
                ;
                context.checkBadCluster = context.checkBadCluster || check.failures.includes( "CLUSTER" );

                if( check.status === "ERROR" ){
                    let error = new Error( check.errorMessage );
                    error.stack = check.errorStack;

                    return resolve({
                        error: error,
                        flow: OutFlow.BREAK,
                        response: {
                            message: check.errorMessage,
                        }
                    })
                }

                return resolve({
                    flow: OutFlow.CONTINUE,
                    error: null,
                    response: {
                        message: `Status checked!`,
                    }
                })
            }

            context.elevator.connected( ( error) => {
                if( error ){
                    return resolve({
                        flow: OutFlow.BREAK,
                        response: {
                            message: error?.message
                        },
                        error: error
                    })
                }
                context.elevator.child.once("checkVerbose",(opts, checkResult) => {
                    onCheckResult( checkResult );
                });
                context.elevator.send( "checkVerbose", opts )
            });

        });
    }
}

export const _CheckVerboseFlow = new CheckVerboseFlow();
