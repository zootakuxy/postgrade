import Path from "path";
import fs from "fs";

export function cleanJs( dirname ){
    //language=file-reference
    if( !dirname ) dirname = Path.join( __dirname, "../" );
    [
        { basename: /*language=file-reference*/ "/olds/server",      math: /.*.js$/, },
        { basename: /*language=file-reference*/ "/olds/server",      math: /.*.js.map$/, },
        { basename: /*language=file-reference*/ "/build",       math: /.*.js$/, },
        { basename: /*language=file-reference*/ "/database",    math: /.*.js$/, },
        { basename: /*language=file-reference*/ "/database",    math: /.*.js.map$/ },
        { basename: /*language=file-reference*/ "/client/resource",    math: /.*.js.map$/ },
        { basename: /*language=file-reference*/ "/client/resource",    math: /.*.js$/ },
    ].forEach( (clean, index) => {
        if( !fs.existsSync( Path.join( dirname, clean.basename ) ) ) return;
        fs.readdirSync( Path.join( dirname, clean.basename ), { recursive: true } ).reverse().forEach( subfile => {
            let filename = Path.join( dirname, clean.basename, subfile );
            let state = fs.statSync ( filename );
            if( !state.isFile() ) return;
            if( !clean.math.test( subfile ) ) return;
            console.log( "[unlink]", `${ new URL(`file://${filename}`).href }`, "..." );
            fs.unlinkSync( filename );
        });
    })
}

if( require.main.filename === __filename ){
    //language=file-reference
    cleanJs( Path.join(__dirname, "../"))
}

