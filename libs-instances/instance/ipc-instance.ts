import {PostgresInstanceOptions} from "./index";
import {CheckResult, CheckStatus} from "./flows/_check";
import {InitDBOptions, InitResult, Response, ServiceOptions} from "../pg-ctl";



export interface IpcPostgresInstanceEvent {
    checkVerbose( opts:CheckStatus, checkResult?:CheckResult ):void

    init( opts:InitDBOptions, error?:Error, result?:InitResult ):void
    initMessage(message:string ):void

    configFiles(configs:PostgresInstanceOptions, error?:Error ):void

    createService( opts:ServiceOptions, createService?:Response ):void
    dropService( opts:ServiceOptions, stopService?:Response ):void

    restartService( service:string, restartService?:Response ):void
    startService( service:string, startService?:Response ):void
    stopService( service:string, stopService?:Response ):void
}