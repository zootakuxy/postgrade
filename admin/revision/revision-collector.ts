import Path from "path";
import fs from "fs";
import {patchSQL, RequiredRegistryOptions, RevisionCore, RevisionListener, RevisionPatch, SimpleFile} from "./index";
import {QueryBuilderResult, SQL} from "../pg-core";
import {NewPatch} from "./revision-applier";
import {SqlPatch, SqlPatchDynamic} from "./sql-path";
import { LogLevel, ScriptLine, scriptUtil} from "../../util";
import {ResultListener} from "../pg-core/query-executor";

export interface PatchCollectorOptions {
    basedir:string
}

let counter = Symbol("counter" );

export function revision<R,N, P>(blockModule:NodeModule|SimpleFile, opts:RequiredRegistryOptions<P>, str: string | QueryBuilderResult, values: any[] ){
    if( !opts ) throw new Error( "Invalid args!");
    if( !opts.unique ) opts.unique = false;
    if( opts.flags ) opts.flags = [];
    const moduleFile = blockModule.filename;
    let block =  new RevisionPatch({ ...opts, moduleFile });
    block.str = str;
    block.values = values;
    return block;
}

export type CollectorResult<P> = {
    error?:Error,
    revisions?:RevisionPatch<P>[],
    collected?:RevisionPatch<P>[]
}

interface RevisionCollectorModel {

}



export class RevisionCollector<P>  implements  RevisionCollectorModel {
    public blocks:RevisionPatch<P>[];
    private collectCounter:number;
    private registeredPath:(SqlPatch<any, any, any>|QueryBuilderResult)[];
    private readonly core:RevisionCore<P>;

    constructor( core:RevisionCore<P> ) {
        this.core = core;
        this.blocks = [];
        this.registeredPath = [];
        this.collectCounter = 0;
    }

    public revisionDir(){
        return Path.join( this.core.basedir, "revisions" );
    }

    public collect():CollectorResult<P>{
        let line = scriptUtil.lineOf( 1 );
        try{
            let revisionDir = this.revisionDir();
            let exists = fs.existsSync( revisionDir );
            if( !exists ){
                this.core.notify( "log", LogLevel.Info, "Creating revision dir...!" );
                fs.mkdirSync( revisionDir, { recursive: true });
            }
            let error = this.collectForm( revisionDir,  line );
            return { error: error }

        } catch (error:Error|any){
            return { error: error }
        }
    }

    public filterNewsBlocks<R,N>( news:NewPatch[] ):RevisionPatch<P>[]{
        return news.filter( value => value.apply )
            .map( canApply => {
                return this.blocks.find( block => block.source === canApply.patch_source && block.identifier === canApply.patch_identifier );
            }).sort( (a, b) => a[counter] - b[ counter])
    }


    register<R,N>(blockModule:NodeModule|SimpleFile, opts:RequiredRegistryOptions<P>, str: string | QueryBuilderResult, values?: any[] | RevisionListener, listener?: RevisionListener):RevisionPatch<P>{
        this.core.notify( "log", LogLevel.Info, `[kitires] RevisionCollector.register identifier = "${ opts?.identifier }"` );

        if( !opts?.identifier ){
            let message = `Invalid registry options missing identifier`;
            this.core.notify( "log", LogLevel.Error, message );
            throw new Error( message );
        }

        if( !blockModule.filename ){
            let message = `Invalid registry options missing source in blockModule.filename!`;
            this.core.notify( "log", LogLevel.Error, message );
            throw new Error( message );
        }

        let block = this.createBlock( blockModule, opts );
        if( !block ) return;

        if( str === "string" && !str?.length ) return;
        else if( typeof str === "object" && (str instanceof QueryBuilderResult) && !str?.noParameterizedQuery().query.length ) return ;

        if( !!str && typeof str === "object" && str instanceof QueryBuilderResult ){
            if( this.registeredPath.indexOf( str ) !== -1 ) return;
        }
        block.str = str;
        if( typeof str === "string" && Array.isArray( values ) ){
            block.values = values;
        }

        block.filename = blockModule.filename;
        let res = this.registerBlock( block );
        if( res && !!str && typeof str === "object" && str instanceof QueryBuilderResult ){
            this.registeredPath.push( str );
        }

        block.line = block.line || block.builder?.line || block.str?.["line"];
        this.core.notifySafe( "register", block );
        return block;
    }

    private createBlock ( blockModule:NodeModule|SimpleFile, opts:RequiredRegistryOptions<P> ):RevisionPatch<P>{
        this.core.notify( "log", LogLevel.Info, `[kitires] RevisionCollector.createBlock identifier = "${ opts?.identifier }"` );
        if( !opts ){
            this.core.notify( "log", LogLevel.Error, `[kitires] RevisionCollector.createBlock identifier = "${ opts?.identifier } Error: Unidentified block options"` );
            throw new Error( "Unidentified block options!");
        }
        if( !opts.unique ) opts.unique = false;
        if( opts.flags ) opts.flags = [];

        const baseFolder = this.core.basedir;
        const moduleFile = blockModule.filename;
        const source = Path.relative( baseFolder, moduleFile ).split( Path.sep ).join( Path.posix.sep )
        return  new RevisionPatch({...opts, source: source, baseFolder, moduleFile});
    }

    private registerBlock<R,N>( block:RevisionPatch<P> ):RevisionPatch<P>{
        this.core.notify( "log", LogLevel.Info, `[kitires] RevisionCollector.registerBlock identifier = "${ block?.identifier }"` );

        if( !block ){
            this.core.notify( "log", LogLevel.Error, `[kitires] RevisionCollector.registerBlock identifier = "${ block?.identifier }" Error: Invalid block args - block is not defined` );
            throw new Error( "Invalid block args - block is not defined" );
        }
        if( !block.filename ){
            this.core.notify( "log", LogLevel.Error, `[kitires] RevisionCollector.registerBlock identifier = "${ block?.identifier }" Error: Block no have filename` );
            throw new Error( "Block no have filename" );
        }

        if( !block.source || !block.baseFolder ) {
            const baseFolder = this.core.basedir;
            const moduleFile = block.filename;
            const source = Path.relative( baseFolder, moduleFile ).split( Path.sep ).join( Path.posix.sep )

            block.baseFolder = this.core.basedir;
            block.source = source;
        }
        if( this.blocks.find( value => {
            return value === block
                || ( value.source === block.source && value.identifier === block.identifier )
            ;
        })){
            let message = `Already exists anther block registered with same identifier in same source | block = "${block.identifier}" source = "${block.source}"`;
            this.core.notify( "log", LogLevel.Error, message );
            throw new Error(  message );
        }

        block[counter] = this.collectCounter++;
        this.blocks.push( block );
        return block;
    }

    public orderOf(block: RevisionPatch<P> ):number{
        return block[ counter ];
    }

    public registerSQL<R,N>(query:string, opts: RequiredRegistryOptions<P>, listener:ResultListener<R,N> , line:ScriptLine) {
        if( !line ) line = scriptUtil.lineOf( 1 );
        this._registerSQL( query, opts, listener, line );
    }
    private _registerSQL<R,N>(query:string, opts: RequiredRegistryOptions<P>, listener:ResultListener<R,N> , line:ScriptLine) {
        this.core.notify( "log", LogLevel.Info, `[kitires] RevisionCollector.registerSQL identifier = "${opts.identifier}` );
        query = (query||"").trim();
        if( !query ){
            let message = `Invalid SQLRawBlock is empty`;
            this.core.notify( "log", LogLevel.Info, message );
            throw new Error( message );
        }
        this.register({  filename: Path.join( this.core.basedir, "file.sql" ) }, opts, new QueryBuilderResult( query, null, line ) );
    }

    public fromSQL( filename:string, opts: RequiredRegistryOptions<P>, line:ScriptLine, respond:( error?:Error, returns?:any )=>void ){
        try {
            let raw = fs.readFileSync( filename ).toString().trim();
            if( !raw ) return null;
            let name = Path.basename( filename );
            let unsafe = SQL.unsafe(raw);
            if( !opts ) opts = {
                unique: /.*.unique.sql$/.test( filename ),
                line: line,
                identifier: null
            };

            const returns = {
                SQL:{
                    [name]: patchSQL({
                        ...opts,
                        module: {
                            filename: filename,
                            id: filename,
                            path: Path.dirname( filename )
                        }
                    }).sql`${unsafe}`
                }
            };
            respond( null, returns );

        } catch (e) {
            respond( e as Error );
        }
    }
    public fromJS( filename:string, respond:( error?:Error, returns?:any )=>void ){
        try {
            const returns = require( filename );
            respond( null, returns );
        } catch ( ex ){
            respond( ex as Error );
        }
    }

    private collectForm( next:string, line:ScriptLine ):Error{
        this.core.notify( "log", LogLevel.Info, `[kitires] RevisionCollector.collectForm folder = "${next}` );
        let self= this;
        if( !fs.existsSync( next ) ) return;
        let catches:Error[] = [];
        let files = fs.readdirSync( next, { recursive: true } )
            .filter( (n) =>{

                let filename = Path.join( next, n.toString() );
                let stat = fs.statSync( filename );
                return stat.isFile() && !stat.isSymbolicLink() && /.*.sql.js$/.test( filename )
                    || stat.isFile() && !stat.isSymbolicLink() && /.*.unique.sql$/.test( filename )
                    || stat.isFile() && !stat.isSymbolicLink() && /.*.sql$/.test( filename )
                    ;
            }).sort();

        let error = files.some( (name, index)=>{
            let filename = Path.join( next, name.toString() );
            let stat = fs.statSync( filename );
            let patch:any;
            let patchType:"DYNAMIC"|"STATIC";

            if ( stat.isFile() && !stat.isSymbolicLink() && /.*.sql.js$/.test( filename ) ) {
                this.fromJS( filename, (error, returns ) => {
                    if( error )  catches.push( error );
                    patch = returns;
                });
                patchType = "DYNAMIC";
            }
            else if ( stat.isFile() && !stat.isSymbolicLink() && /.*.sql$/.test( filename ) ) {
                this.fromSQL( filename, null, line, (error, returns) => {
                    if( error ) catches.push( error );
                    else patch = returns;
                });
                patchType = "STATIC";
            }
            console.log( filename );
            if( !!patch ) this.collectObject( patch, filename );
            return catches.length > 0;
        });

        catches.forEach( value => {
            console.log( "Error Collected", value );
        });
        return catches[0];
    }

    public clean(){
        this.blocks.length = 0;
        this.collectCounter = 0;

    }

    collectObject( patch:any, filename:string ){
        let self = this;
        let collectError:Error[] = [];
        let circular = new Set();
        //Collectar todas as revisões encontradas no escript recursivamente
        let breakListener:RevisionListener = {
            onRegister(error: Error, onRelease: () => void) {
                if( error ) {
                    collectError.push(error);
                    self.core.notify( "error", error );
                }
            }
        }

        let register = ( value:SqlPatch<any, any, any>|QueryBuilderResult, ...sourcePath:(string|number)[])=>{
            if( this.registeredPath.indexOf( value ) !== -1 ) return;
            if( value instanceof SqlPatch ){
                let opts = value.opts;
                if( !opts && patch === value ){
                    opts = { identifier:  Path.basename( filename ) };
                }

                if( !opts ) opts = {};
                if( !opts?.identifier ) opts.identifier =  sourcePath.join( "." );
                opts.line = opts.line || value.line;
                this.register({ filename }, opts as any, value.str, value.values, value.listener, )
            } else if( value instanceof QueryBuilderResult ) {
                this.register( { filename }, { identifier: sourcePath.join(".") }, value, breakListener );
            }
        }
        let recurseReadObject= ( any:any, ...sourcePath:(string|number)[])=>{
            if( circular.has( any ) ) throw new Error( "Circular reference error!" );
            circular.add( any );

            let onIterate = ( key:string|number, value:any )=>{
                if( !value ) return;
                if( value instanceof SqlPatchDynamic && typeof value.callback === "function" ) {
                    return  onIterate( key, value.callback( this.core.options.props, this.core ))
                }
                if( value instanceof SqlPatch || value instanceof QueryBuilderResult ) return  register( value, ...sourcePath, key );
                if( Array.isArray( value )|| typeof value === "object" ) recurseReadObject( value, ...sourcePath, key );
            }

            if( any && typeof any === "object" ){
                Object.entries( any ).forEach( ([ key, value ]) => {
                    return onIterate( key, value );
                });
            } else if ( Array.isArray( any ) ){
                any.forEach( (value, index)=>{
                    return onIterate( index, value )
                });
            }
        };

        recurseReadObject( patch  );
    }

}

export function hasCircularReference(obj: any, seen = new Set()): boolean {
    if (obj !== null && typeof obj === 'object') {
        if (seen.has(obj)) {
            return true;
        }
        seen.add(obj);

        for (const key in obj) {
            if (obj.hasOwnProperty(key) && hasCircularReference(obj[key], seen)) {
                return true;
            }
        }

        seen.delete(obj);
    }
    return false;
}
