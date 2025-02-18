import axios from "axios";
import fs from "fs";
import Path from "path";

namespace postgrade {

    export type PGAuthMethod = "trust"|"rejected"|"md5"|"password"|"reject"|"scram-sha-256"|"gss"|"sspi"|"ident"|"peer"|"pam"|"ldap"|"radius"|"cert";

    export type HBAOptions = {}


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
    export type HBA = {
        type:"local"|"host",
        database:string|"sameuser"|"samerole"|"all"|"replication",
        user:string|"all",
        address?:string|"*"|"samehost"|"samenet",
        method:PGAuthMethod,
        options?:HBAOptions
    }

    export type Grant = {
        expression:string,
        user:string
        object:string
    }


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

    export type DatabaseSetup = {
        filename:string,
        superuser?:boolean
        noCritical?:boolean
        user?:string
    };

    export type Database = {
        sys?:string
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

    export interface Configs {
        sys?:string,
        setup:{
            host?:string,
            port?:number,
            app:string,
            volume?:string
        },
        database?:Database[]
        users?:PgUser[],
        hba?:HBA[],
    }

    export type PostgradeError = Error & {
        data?:any
        settings?:Configs
        statusText?:string
        status?:number
    }

    export type PostgradeResponse = {
        result?:boolean
        returns?:SetupReturns
        settings?:Configs
        statusText?:string
        status?:number,
        message?:string
    }

    export type Notified = { event?:"log"|"message"|"setup"|"flowResolved", text?:string, args?:any };

    export type PostgresInstanceSetup = {
        status?:boolean,
        actions:( PostgresContextSteep )[]
    }

    export type SetupReturns = {
        result:boolean,
        message?:string
        messageError?:string
        hint?:any
        setups?:PostgresInstanceSetup
        notified?:Notified[]
    }


    export function setup( opts:Configs, resolve:( error?:PostgradeError, response?:PostgradeResponse)=>void ){
        let origin = `http://${ opts?.setup?.host||"admin" }:${ opts?.setup?.port || 80 }`;
        let volume = opts?.setup?.volume || "/etc/postgrade";
        let destination = Path.join( volume, "setups", opts.setup.app );
        fs.mkdirSync( destination, { recursive:true});
        fs.mkdirSync( Path.join( destination, "setups" ), { recursive:true});
        fs.mkdirSync( Path.join( destination, "bases" ), { recursive:true});


        let override:Configs = JSON.parse( JSON.stringify( opts ));
        (override?.database||[]).forEach( database =>  {
            if( database.base && fs.existsSync( database.base ) ) {
                let current = database.base;
                database.base = Path.join(  "bases", `${database.dbname}@${database.owner}.init.db` );
                fs.copyFileSync( current, Path.join( destination, database.base) );
            }

            (database.setups||[]).forEach( (setup, index ) => {
                let current = setup.filename;
                let basename = Path.basename( current, ".sql" );
                setup.filename = Path.join( "setups", `sets-${ (index+"").padStart( 5, "0" ) }-${basename}.sql` );
                fs.copyFileSync( current, Path.join( destination, setup.filename ) );
            });
        });

        fs.writeFileSync( Path.join( destination, "setup.json" ), JSON.stringify( override, null, 2 ) );

        axios.post( `${ origin }/api/admin/setup/${ opts?.setup?.app }`, opts ).then( response => {
            let error = new Error( "Falha ao configurar a base de dados!" ) as PostgradeError;
            error.settings = override;
            error.status = response.status;
            error.statusText = response.statusText;
            error.data = response.data;
            let returns = response.data as SetupReturns;

            return resolve( null, {
                result: response.status === 200
                    && !!response.data?.result
                ,
                settings: override,
                returns: returns,
                status: response.status,
                statusText: response.statusText,
                message: returns?.message
            });

        }).catch( reason => {
            let error = reason as PostgradeError;
            if( !error ) error = new Error( "Falha ao configurar a base de dados! Com error desconhacido!" );
            error.settings = override;
            return resolve( error );
        });
    }

}

export = postgrade;