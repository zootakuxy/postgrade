import {definition, EnvOptions} from "../env";

require( "source-map-support" ).install();
import fs from "fs";
import Path from "path";

import {ArgsOptions, environments} from "../../libs/utils/env";
import {context} from "./context/index";

export function startServer( opts?:ArgsOptions<EnvOptions> ){
    let load = environments<EnvOptions>( EnvOptions, definition, opts );

    if( load.failures.length ) {
        load.failures.forEach( value => {
            console.error( context.tag, `Load environment failed`, value.message );
        });
        return process.exit( -1 );
    }

    context.define( load.env );

    console.table( context.env );

    let routes = Path.join( __dirname, /*language=file-reference*/ "./routes" );
    let filter = new RegExp(`((^)*.${"route.js"})$`);
    console.log( routes, fs.existsSync( routes ) )
    if( fs.existsSync( routes ) ) {
        fs.readdirSync( routes, { recursive: true,  withFileTypes: true} ).map( file => {
            if( !file.isFile() ) return;
            if( !filter.test( file.name  ) ) return;
            console.log( `Loading file route:`, new URL( `file://${Path.join( file.path, file.name ) }`).href )
            let req = require( Path.join( file.path, file.name )  );
        })
    }
}

if( require.main.filename === __filename ){
    startServer({})
}

process.on('SIGINT', () => {
    console.log('Ctrl+c... exiting');
    setTimeout(() => {
        process.exit(0);  // Encerra o processo com código de sucesso
    }, 500);
});
