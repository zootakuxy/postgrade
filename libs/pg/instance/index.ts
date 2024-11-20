import Path from "path";
import {IpcPostgresInstanceEvent} from "./ipc-instance";
import {Pool} from "pg";
import {SpawnOptions} from "child_process";
import {CheckResult, ConnectionTest} from "./flows/_check";
import os from "os";
import {PGAuthMethod} from "../pg-ctl";
import { ElevatorServer } from "kitres/src/core/system/elevator";
import {BaseEventEmitter, Flow, LogLevel, PgCore, SteepFlow, WorkFlow, WorkFlowEndCode} from "kitres";
import {PgInstallation} from "../pg-register";
import { OIDResourceManager } from "kitres/src/core/database/resource";
import {System} from "kitres/src/core/system";


export enum PostgresContextSteep {
    FLOW_START = "PostgresContextSteep.FLOW_START",
    SETUP = "PostgresContextSteep.SETUP",
    FLOW_CHECK_PRE= "PostgresContextSteep.FLOW_CHECK_PRE",
    FLOW_CHECK_VERBOSE = "PostgresContextSteep.FLOW_CHECK_VERBOSE",
    CTL_INIT = "PostgresContextSteep.CTL_INIT",
    SRV_DROP = "PostgresContextSteep.SRV_DROP",
    SRV_CREATE = "PostgresContextSteep.SRV_CREATE",
    CONF_FILE = "PostgresContextSteep.CONF_FILE",
    SRV_RESTART = "PostgresContextSteep.SRV_RESTART",
    DB_USER_CREATE = "PostgresContextSteep.DB_USER_CREATE",
    DB_DATABASE_CREATE = "PostgresContextSteep.DB_DATABASE_CREATE",
    DB_DATABASE_EXTENSIONS = "PostgresContextSteep.DB_DATABASE_EXTENSIONS",
    DB_DATABASE_IMPORT = "PostgresContextSteep.DB_DATABASE_IMPORT",
    DB_USER_CONFIGS = "PostgresContextSteep.DB_USER_CONFIGS",
    DB_DATABASE_CONFIG = "PostgresContextSteep.DB_DATABASE_CONFIG",
    DB_DATABASE_SETUP = "PostgresContextSteep.DB_DATABASE_SETUP",
    SRV_START = "PostgresContextSteep.SRV_START",
    FLOW_END = "PostgresContextSteep.FLOW_END",
}
export const FlowSteeps = Object.values( PostgresContextSteep );

export type PgUser = {
    username:string,
    password:string,
    schemas?:string[],
    search?:string[],
    superuser?:boolean,
    replication?:boolean,
    tests?:({
        database:string
    })[]
}

export type Grant = {
    expression:string,
    user:string
    object:string
}

export type DatabaseSetup = {
    filename:string,
    superuser?:boolean
    noCritical?:boolean
    user?:string
};

export type Database = {
    dbname:string,
    extensions?:string[],
    newExtensions?:string[],
    extensionSchema?:string,
    schemas?:string[],
    search?:string[],
    owner:string,
    base?:string,
    grants?:Grant[],
    setups?:DatabaseSetup[]
}

export type HBAOptions = {}
export type HBA = {
    type:"local"|"host",
    database:string|"sameuser"|"samerole"|"all"|"replication",
    user:string|"all",
    address?:string|"*"|"samehost"|"samenet",
    method:PGAuthMethod,
    options?:HBAOptions
}

export enum InstallationLocation {
    LOCAL = "InstallationLocation.LOCAL",
    REMOTE = "InstallationLocation.REMOTE"
}
export type PostgresInstanceOptions = {
    NODE_ENV?: 'development' | 'production' | 'test';
    installerLocation:InstallationLocation
    clusterLocation:InstallationLocation
    serverHost:string,
    spawn?:SpawnOptions,
    cluster:string,
    service:string,
    superuser:PgUser,
    init?:{
        auth:PGAuthMethod
        noLocale:boolean,
        encoding:BufferEncoding
    },
    configs:{
        port?:number,
        listenAddress?:string,
        database?:Database[]
        users?:PgUser[],
        hba?:HBA[],
    },
    cli?:{
        psql?:string
        pg_dump?:string
        initdb?:string,
        initdbMethod?:"initdb"
    }
    target?:number,
    minVersion?:number
}

export type PgFlow = SteepFlow<PostgresContext, DBFlowResponse, PostgresContextSteep>;
export type PgSteepFlow = Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>;



export interface PostgresInstanceEvent{
    log( level:LogLevel, message:string ):void
    setup( error?:Error, result?:PostgresInstanceSetup ):void
    message(   message:string, action?:"init" ):void
    flowResolved(flow:PgFlow, preview: PgFlow ):void
    flowSync(steep: PostgresContextSteep, flow: PgSteepFlow, accept: boolean): void;
    flowSkip(steep: PostgresContextSteep, flow: PgSteepFlow ): void;

}

type ExtensionNotice = {
    extension:string
}

type AnyObject = { [p:string]:any }
export interface DBFlowResponse extends AnyObject {
    message:string
}

export type PostgresInstanceSetup = {
    status?:boolean,
    actions:( PostgresContextSteep )[]
}

export type SetupRespond = {
    result:boolean,
    message?:string
    messageError?:string
    hint?:any
    setups?:PostgresInstanceSetup
}

export class PostgresContext extends BaseEventEmitter<PostgresInstanceEvent>{
    public options:PostgresInstanceOptions;
    private _elevator:ElevatorServer<IpcPostgresInstanceEvent>;
    public workFlow:WorkFlow<PostgresContext,DBFlowResponse,PostgresContextSteep>;
    public check: CheckResult;
    public checkBadCluster: boolean;
    public installation:PgInstallation
    public installationBin:string

    private _pgCore:{
        [user:string]:{
            [p:string]:OIDResourceManager<any>
        }
    } = {};

    constructor( opts:PostgresInstanceOptions ) {
        super();
        this.options = opts;
        //language=file-reference
        this.workFlow = new WorkFlow<PostgresContext,DBFlowResponse,PostgresContextSteep>(this);
        //language=file-reference
        this.workFlow.flows( ...WorkFlow.collect(Path.join(__dirname, "flows" ) ) );
        // this.workFlow.steepsOrder( ...FlowSteeps );
        this.workFlow.on( "resolved", (flow, preview) => {
            this.notify( "flowResolved", flow as any, preview as any );
        });
        this.workFlow.on( "sync", (steep, flow, accept) => {
            this.notify( "flowSync", steep, flow, accept );
        });
        this.workFlow.on( "skip", (steep, flow) => {
            this.notify( "flowSkip", steep, flow );
        });
    }

    setup( response:( error:Error, result?: PostgresInstanceSetup)=>void){
        this.workFlow.start( (error, result ) => {
            return response( error, {
                status: !error
                    && !!result
                    && !result.error
                    && result.end === WorkFlowEndCode.FINALLY
                    && result.pendent.length === 0
                ,
                actions: this.workFlow.steepsPass,
            })
        });
    }

    pgCoreOf( user:PgUser, database:string ){
        if( !this._pgCore[user.username] ) this._pgCore[user.username] = {};
        if (!this._pgCore[user.username][database]){
            let core = new PgCore(() => {
                    return new Pool( {
                        host: this.serverHost,
                        port: this.options.configs.port,
                        user: user.username,
                        password:  user.password,
                        database: database
                    });
                }
            );
            this._pgCore[user.username][database] = new OIDResourceManager(core)
        }
        return this._pgCore[user.username][database];
    }

    superTo(database:string ){
        return this.pgCoreOf( this.options.superuser, database );
    }
    get superuser(){
        return this.superTo(  "postgres" );
    }

    get base(){
        return this.options.cluster;
    }

    get users():PgUser[]{
        return this.options.configs.users;
    }

    get service(){
        return this.options.service;
    }

    get elevator(){
        if( !this._elevator ){
            let opts = this.options.spawn;
            if( !opts ) opts = {};
            if( !opts.env ) opts.env = {
                NODE_ENV: this.options?.NODE_ENV
            }

            if( opts.env[ System.pathName() ]){
                opts.env[ System.pathName() ] = [
                    this.installationBin,
                    ... opts.env[ System.pathName() ].split( Path.delimiter )
                ].join( Path.delimiter )
            } else {
                opts.env[ System.pathName() ] = process.env[ System.pathName() ];
            }
            this._elevator = System.elevateRequire<IpcPostgresInstanceEvent>( Path.join( __dirname,
                /*language=file-reference*/ "elevated-flow.js"
            ), opts );
            this._elevator.on( "close", code => {
                this._elevator = null;
            })
        }
        return this._elevator;
    }

    get database():Database[]{
        return this.options.configs.database;
    }

    get port(){
        return this.options.configs.port;
    }

    get installerLocation(){
        return this.options.installerLocation;
    }

    get clusterLocation(){
        return this.options.clusterLocation;
    }

    get serverHost(){
        return this.options.serverHost;
    }

    get connections(){
        let connections:ConnectionTest []= [{
            username: this.options.superuser.username,
            database: "postgres",
            password: this.options.superuser.password,
            host: this.serverHost
        }];

        this.users.forEach( user => {
            connections.push( ... user.tests.map( test => {
                return {
                    username: user.username,
                    database: test.database,
                    password: user.password,
                    host: this.serverHost
                }
            }));
        });
        return connections;
    }

    cli( name:string, cli?:string ):string {
        cli = cli || name;
        let _cli = cli;
        if( os.platform() === "win32" ) _cli = `${cli}.exe`;
        return this.options?.cli?.[ name ]
            || _cli ;
    }

    psql() { return this.cli( "psql" ); }
    pg_dump() { return this.cli( "psql" ); }
    initdb() { return this.cli( "initdb" ); }
}

