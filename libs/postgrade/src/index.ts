import {Database, HBA, PgUser} from "kitres/src/core/database/instance";
import axios from "axios";
import fs from "fs";
import Path from "path";

namespace postgrade {
    export interface Configs {
        setup:{
            host?:string,
            port?:number,
            app:string,
            volume?:string
        }
        database?:Database[]
        users?:PgUser[],
        hba?:HBA[],
    }

    export function setup( opts:Configs, resolve:( error?:Error )=>void ){
        let origin = `http://${ opts?.setup?.host||"admin" }:${ opts?.setup?.port || 4000}`;
        let volume = opts?.setup?.volume || "/etc/postgrade/setup";
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

        axios.post( `${ origin }/api/admin/setup/${ opts?.setup?.app }`, opts ).then( value => {
            let error = new Error( "Falha ao configurar a base de dados!" );
            error["settings"] = override;
            error["status"] = value.status;
            error["statusText"] = value.statusText;
            error["data"] = value.data;
            if( value.status !== 200 ) return resolve( error );

        }).catch( reason => {
            if( !reason ) reason = new Error( "Falha ao configurar a base de dados! Com error desconhacido!" );
            return resolve( reason );
        });
    }
}

export = postgrade;