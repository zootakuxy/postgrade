import { DatabaseSetup, Grant, HBA} from "kitres/src/core/database/instance";
import axios from "axios";
import fs from "fs";
import Path from "path";

namespace postgrade {

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
        data?:any
        settings?:Configs
        statusText?:string
        status?:number,
        message?:string
    }

    export function setup( opts:Configs, resolve:( error?:PostgradeError, response?:PostgradeResponse)=>void ){
        let origin = `http://${ opts?.setup?.host||"admin" }:${ opts?.setup?.port || 80 }`;
        let volume = opts?.setup?.volume || "/etc/postgrade/setups";
        let destination = Path.join( volume, opts.setup.app );
        fs.mkdirSync( destination, { recursive:true});
        fs.mkdirSync( Path.join( destination, "setups" ), { recursive:true});


        let override:Configs = JSON.parse( JSON.stringify( opts ));
        (override?.database||[]).forEach( database =>  {
            if( database.base && fs.existsSync( database.base ) ) {
                let current = database.base;
                database.base = Path.join( destination, "init.db" );
                fs.copyFileSync( current, database.base );
            }

            (database.setups||[]).forEach( (setup, index ) => {
                let current = setup.filename;
                setup.filename = Path.join( destination, "setups", `sets-${ (index+"").padStart( 5, "0" ) }.sql` );
                fs.copyFileSync( current, setup.filename );
            });
        });

        fs.writeFileSync( Path.join( volume, opts.setup.app, "setup.json" ), JSON.stringify( override, null, 2 ) );

        axios.post( `${ origin }/api/admin/setup/${ opts?.setup?.app }`, opts ).then( response => {
            let error = new Error( "Falha ao configurar a base de dados!" ) as PostgradeError;
            error.settings = override;
            error.status = response.status;
            error.statusText = response.statusText;
            error.data = response.data;

            return resolve( null, {
                result: response.status === 200
                    && !!response.data?.result
                ,
                settings: override,
                data: response.data,
                status: response.status,
                statusText: response.statusText,
                message: response.data?.message
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