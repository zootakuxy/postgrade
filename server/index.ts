import {execSync, spawn} from "node:child_process";

require( "source-map-support" ).install();
import fs from "fs";
import Path from "path";

import {ArgsOptions, environments} from "../env";
import {context} from "./context/index";
import os from "os";


export function startServer( opts?:ArgsOptions ){
    let load = environments( opts );

    if( load.failures.length ) {
        load.failures.forEach( value => {
            console.error( context.tag, `Load environment failed`, value.message );
        });
        return process.exit( -1 );
    }

    context.define( load.env );

    let routes = Path.join( __dirname, "./routes" );
    let filter = new RegExp(`((^)*.${"route.js"})$`);
    if( fs.existsSync( routes ) ) {
        fs.readdirSync( routes, { recursive: true,  withFileTypes: true} ).map( file => {
            if( !file.isFile() ) return;
            if( !filter.test( file.name  ) ) return;
            require( Path.join(routes, file.name )  );
        })
    }
}


if( require.main.filename === __filename ){
    startServer({})
}