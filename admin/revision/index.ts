import * as fs from "fs";
import * as Path from "path";
import {PgConnection, QueryListener} from "../pg-core";
import {QueryBuilderResult} from "../pg-core";
import {RevisionApplier, RevisionApplierNotice} from "./revision-applier";
import {RevisionCollector} from "./revision-collector";
import {AppVersion, BaseEventEmitter, LogEvent, ScriptLine, scriptUtil} from "../../util";
import {LogLevel} from "../../util";
import {nanoid} from "nanoid";
import {RevisionChecker} from "./revision-checker";
import {RevisionSetup} from "./revision-setup";
import {ResultListener} from "../pg-core/query-executor";
import db_patch from "../patches";

export {SqlPatch, patchSQL, dynamicSQL, patch, SqlPatchDynamic, PatchOptions} from "./sql-path";
export type RevisionProps<T extends {[p in keyof T]:T[p]}> = T
export type RevisionWhen<P> = boolean|( (props:RevisionProps<P>)=>boolean)|( (props:RevisionProps<P>)=>Promise<boolean>);

// Define as opções disponíveis para um bloco de revisão
export interface RegistryOptions <P>{
    identifier?: string;
    connection?: string|"default"|"standard"|"superuser";
    unique?: boolean;
    force?: string;
    flags?: string[];
    level?: "critical" | "normal" | "optional";
    line?:ScriptLine,
    when?:RevisionWhen<P>
}
export interface RequiredRegistryOptions<P> extends RegistryOptions<P> {
    identifier: string;
}

const acceptRegister = Symbol.for("acceptRegister");

// Classe que representa um bloco de revisão
export class RevisionPatch<P> implements RequiredRegistryOptions<P> {
    public identifier: string;
    public unique?: boolean;
    public force?: string;
    public flags?: string[];
    public source?: string;
    public baseFolder?: string;
    public moduleFile: any;
    public script?: string;
    public builder?: QueryBuilderResult;
    public str?: string | QueryBuilderResult;
    public values?: any[];
    public connection?: string|"default"|"standard"|"superuser";
    public filename?: string;
    public line?:ScriptLine
    public when?:RevisionWhen<P>
    public hash?:string
    constructor(opts: RevisionPatch<P>) {
        Object.assign(this, opts);
        this.hash = `${opts.source}//${opts.identifier}:${ nanoid( 32 ) }`
    }
}

// Define o tipo de ouvinte de revisão que inclui tratamento de atualização
export type RevisionListener = {
    onRegister?(error: Error, onRelease: () => void): void;
};

// Interface para representar um arquivo simples
export interface SimpleFile {
    filename: string;
}

// Tipos de eventos de revisão

// Opções disponíveis para o núcleo de revisão
interface RevisionCoreModel<P>  {
    setup(): Promise<{ error?: Error; blocks: RevisionPatch<P>[] }>;
    setup(listener: (error?: Error, block?: RevisionPatch<P>[]) => void):void;
    registerSQLFile<R, N>(
        sqlFile: string,
        opts: RequiredRegistryOptions<P>,
        listener?: ResultListener<R, N>
    ):void;
    registerSQL<R, N>(
        query: string,
        opts: RequiredRegistryOptions<P>,
        listener?: ResultListener<R, N>
    ):void;
    register<R, N>(
        blockModule: NodeModule | SimpleFile,
        opts: RequiredRegistryOptions<P>,
        str: string | QueryBuilderResult,
        values: any[] | RevisionListener,
        listener?: RevisionListener
    ):void;
}

// Opções disponíveis para o núcleo de revisão
export interface RevisionOptions<T> {
    schema: string;
    dirname: string;
    resolvedDirectory:string
    VERSION?: AppVersion<any>;
    history?:boolean;
    props?:RevisionProps<T>
}

export type RevisionsChecks = {
    error?:Error,
    accept?:boolean,
    message?:string
}
//export type RevisionEvent = "revision" | "collect" | "log";
interface RevisionEventListener<P> extends LogEvent {
    /**
     * On news revision to apply on database
     * @param blocks
     */
    news( blocks: RevisionPatch<P>[] ):Promise<RevisionsChecks>,

    /**
     * On revision result
     * @param error
     * @param blocks
     * @param registers
     */
    revision( error?:Error, blocks?: RevisionPatch<P>[] , registers?: RevisionPatch<P>[] ):void,

    /**
     * O collect path
     * @param blocks
     */
    collect( blocks: RevisionPatch<P>[] ):void

    /**
     * On collect error
     * @param error
     */
    collectError( error:Error ):void

    /**
     * On register Patch
     * @param blocks
     */
    register( blocks: RevisionPatch<P> ):void

    /**
     * On apply result notice
     * @param notice
     */
    applierNotice( notice:RevisionApplierNotice ):void

    /**
     * On register notice
     * @param reg
     */
    register( reg:RevisionPatch<P> ):void

    /**
     * On error
     * @param error
     */
    error( error:Error ):void;

}



// Classe principal que representa o núcleo de revisão
export class RevisionCore<P> extends BaseEventEmitter< RevisionEventListener<P> > implements RevisionCoreModel<P> {
    private patchApplier: RevisionApplier<P>;
    private readonly patchCollector: RevisionCollector<P>;
    private lastResult:{error:Error, blocks:RevisionPatch<P>[], registers:RevisionPatch<P>[]};
    public options:RevisionOptions<P>;
    private checker:RevisionChecker<P>;
    private setupper:RevisionSetup<P>;
    private _connectionResolver:( connection:string )=>PgConnection;
    private _resolved: { [p: string]: PgConnection };
    constructor( connectionResolver:( connection:string )=>PgConnection, opts?: RevisionOptions<P>) {
        super();
        this.options = opts;
        this._resolved = {};
        this.patchCollector = new RevisionCollector(this);
        this.checker = new RevisionChecker( this );
        this.patchApplier = new RevisionApplier( this );
        this.setupper = new RevisionSetup( this );
        // Adicione uma mensagem de log para indicar que o núcleo de revisão foi inicializado
        this.notify("log", LogLevel.Info, "RevisionCore initialized.");
        this._connectionResolver = connectionResolver;
    }

    setsOptions( opts:RevisionOptions<P>){
        this.options = opts;
        db_patch.applyOn( this );
    }
    // Retorna o caminho da pasta de revisão
    get revisionFolder() {
        return Path.join(this.options.dirname, "revisions");
    }

    get collector(){
        return this.patchCollector;
    }

    get props():RevisionProps<P>{
        if( this.options.props ) this.options.props = {} as P;
        return this.options.props;
    }

    // Retorna o diretório base
    get basedir() {
        return this.options.dirname;
    }

    /**
     * Resolved directory
     */
    get resolveDirectory(){
        return this.options.resolvedDirectory;
    }

    get schema(){
        return this.options.schema;
    }

    // Limpa a coleta de revisões
    public clean() {
        this.patchCollector.clean();
        db_patch.applyOn( this );
    }

    connectionOf( connection?:string ){
        if( !connection ) connection = "default";
        if( !!this._resolved[connection] ) return  this._resolved[connection];
        this._resolved[connection] = this._connectionResolver( connection );
        return  this._resolved[connection];
    }

    // Registra um bloco de revisão com SQL diretamente
    register<R, N>(
        blockModule: NodeModule | SimpleFile,
        opts: RequiredRegistryOptions<P>,
        str: string,
        values: any[],
        listener?: RevisionListener
    ): void;

    // Registra um bloco de revisão com uma consulta QueryBuilderResult
    register<R, N>(
        blockModule: NodeModule | SimpleFile,
        opts: RequiredRegistryOptions<P>,
        query: QueryBuilderResult,
        listener?: RevisionListener
    ): void;

    // Método que lida com o registro de blocos de revisão
    register<R, N>(
        blockModule: NodeModule | SimpleFile,
        opts: RequiredRegistryOptions<P>,
        str: string | QueryBuilderResult,
        values: any[] | RevisionListener,
        listener?: RevisionListener
    ) {
        let _revisionListener: RevisionListener;
        if (
            !!str &&
            typeof str === "object" &&
            !!values &&
            typeof values === "object" &&
            !Array.isArray(values)
        ) {
            _revisionListener = values;
        } else if (typeof str === "string") {
            _revisionListener = listener;
        }
        this.patchCollector.register(
            blockModule,
            opts,
            str,
            values,
            listener
        );
        if (typeof _revisionListener?.onRegister === "function")
            _revisionListener.onRegister(null, () => {});
        return;
    }

    // Registra um arquivo SQL para revisão
    registerSQLFile<R, N>(
        sqlFile: string,
        opts: RequiredRegistryOptions<P>,
        listener?: QueryListener<R, N>
    ) {
        let line  = scriptUtil.lineOf( 1 );
        let _returns:any;
        this.patchCollector.fromSQL( sqlFile, opts, line, (error, returns) => {
            if( error ){ throw error }
            _returns = returns;
        });
        this.patchCollector.collectObject(
            _returns,
            sqlFile
        );
    }

    // Registra uma consulta SQL para revisão
    registerSQL<R, N>(
        query: string,
        opts: RequiredRegistryOptions<P>,
        listener?: QueryListener<R, N>
    ) {
        let line  = scriptUtil.lineOf( 1 );
        this.patchCollector.registerSQL(query, opts, listener, line);
    }

    // Gera um nome de arquivo a resulução da revisão
    private resolveName() {
        const min = 100000;
        const max = 999999;
        const random = Math.floor(Math.random() * (max - min + 1)) + min;
        if( this.options.history ){
            return `upgrade-${this.options.VERSION.VERSION_CODE}.upgrade`;
        }
        return `upgrade.upgrade`;
    }

    private formatDate(date:Date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
        return `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;
    }

    // Configuração inicial do núcleo de revisão
    setup<R, N>(): Promise<{ error?: Error; blocks: RevisionPatch<P>[]; registers: RevisionPatch<P>[]}>;
    setup<R, N>(listener: (error?: Error, block?: RevisionPatch<P>[]) => void):void;

    setup<R, N>(
        listener?: (error?: Error, block?: RevisionPatch<P>[], registers?:RevisionPatch<P>[]) => void
    ): Promise<{ error?: Error; blocks: RevisionPatch<P>[]; registers: RevisionPatch<P>[] }> {
        let line = scriptUtil.lineOf(1);
        let _listen = (  resolve: (error: Error, blocks: RevisionPatch<P>[], registers:RevisionPatch<P>[]) => void ) => {
            try {
                this.setupper.prepareDatabase( error => {
                    if( error ) {
                        if( !!error && !error[ "REVISION_CODE" ] ) error["REVISION_CODE"] = "PREPARE_ERROR";
                        resolve( error, null, this.collector.blocks );
                        return;
                    }
                    this.checker.check( this.collector.blocks, (checkResult, error) => {
                        if( error ){
                            if( !!error && !error[ "REVISION_CODE" ] ) error["REVISION_CODE"] = "CHECK_ERROR";
                            resolve( error, null, this.collector.blocks );
                            this.notify( "log", LogLevel.Error, error.message );
                            return;
                        }

                        let _VER = this.options.VERSION;
                        if( !!checkResult && !!checkResult.currentVersion && !!checkResult.currentVersion.version_code ){
                            let currentVersion = checkResult.currentVersion.version_code;
                            let newVersion = _VER.VERSION_CODE;
                            let compareTo = this.options.VERSION.compareTo( currentVersion );
                            let [ newVer, currentVer, recode]  = compareTo;
                            if( currentVer > newVer ) {
                                let error = new Error( `The current database version is higher than the new database version! CurrentVersion = "${ currentVersion }" NewVersion = "${ newVersion }"` );
                                error["REVISION_CODE"] = "SMALLER_VERSION_ERROR";
                                resolve( error, null, this.collector.blocks);
                                this.notify( "log", LogLevel.Error, error.message );
                                return;
                            }
                        }

                        let news = checkResult.news;
                        if (!news?.length ) {
                            resolve(null, [], this.collector.blocks);
                            this.notify( "log",  LogLevel.Info, "NOT change detected!" );
                            return;
                        }

                        let nextFile = this.resolveName();
                        let resolveDir = Path.join(this.resolveDirectory, "history" );
                        if ( !fs.existsSync( resolveDir ) ) fs.mkdirSync( resolveDir, { recursive: true });
                        let lastFileName: string = Path.join( this.resolveDirectory, "last.revision.sql" );

                        let prepare = this.notify( "news", news )
                            .map( value => value.response )
                        ;

                        let apply = ()=>{
                            this.patchApplier.apply(
                                {
                                    blocks: news,
                                    lastFileName,
                                    nextFile,
                                    resolve: resolveDir
                                }, ( error, blocks) => {
                                    if (error) return resolve( error, null, this.collector.blocks );
                                    resolve(null, blocks, this.collector.blocks);
                                }
                            );
                        }

                        Promise.all( prepare ).then( value => {
                            let rejection = value.filter( check => {
                                return !check
                                    || check.error
                                    || !check.accept
                            });
                            let error:Error;
                            if( rejection.length ){
                                let messages = "";
                                rejection.forEach( (check, index) => {
                                    if( !check ) return;
                                    messages+="\n";
                                    if( check?.message ) {
                                        messages+= `Message = "${ check?.message }"`
                                    } else {
                                        messages += `Error = "${ check?.error?.message }`
                                    }

                                    if( !error && check?.error && check?.error instanceof Error ) {
                                        error = check?.error
                                    }
                                })
                                if( !error ){
                                    error = new Error( `Database revision rejected message = "${messages.trim()}"` );
                                    error["REVISION_CODE"] = "REJECTION_ERROR";
                                } else {
                                    error.message = `Database revision rejected message = "${messages.trim()}"`;
                                    if( !error["REVISION_CODE"]) error["REVISION_CODE"] = "REJECTION_ERROR";
                                }
                                resolve( error, null, this.collector.blocks);
                            }
                            else apply()
                        }).catch( reason => {
                            if( reason ) resolve( reason, null, this.collector.blocks );
                        });

                    }, line);
                })
            } catch (error) {
                this.notify(
                    "log",
                    LogLevel.Error,
                    `Error during setup: ${error?.["message"]}`
                );
                return resolve(error as Error, null, this.collector.blocks);
            }
        };

        if( typeof listener === "function" ){
            _listen( (error, blocks, registers) => {
                if( !!error && !error[ "REVISION_CODE" ] ) error["REVISION_CODE"] = "REJECTION_ERROR";
                this.lastResult = { error: error, blocks: blocks, registers:[...registers] };
                this.clean();
                listener( this.lastResult.error, this.lastResult.blocks, this.lastResult.registers );
                this.notify("revision", error, blocks, this.lastResult.registers );
            });
            return;
        }
        return new Promise( resolve => {
            _listen((error, blocks, registers ) => {
                if( !!error && !error[ "REVISION_CODE" ] ) error["REVISION_CODE"] = "REJECTION_ERROR";
                this.lastResult = { error: error, blocks: blocks, registers:[...registers] };
                this.clean();
                resolve( this.lastResult );
                this.notify("revision", error, blocks, this.lastResult.registers );
            });
        });

    }

    public hasRevision():Promise<{ result:boolean, error:Error }>
    public hasRevision( onResult:(result?:boolean, error?:Error)=>void);
    public hasRevision( resolve?:(result?:boolean, error?:Error)=>void):Promise<{ result:boolean, error:Error }>|void{
        let line = scriptUtil.lineOf( 1 );
        // return this.checker.check()
        if( typeof resolve === "function" ){
            this.checker.check( this.collector.blocks, ( checkResult, error) => {
                let news = checkResult?.news;
                resolve( !!error && news?.length > 0, error );
            }, line);
            return;
        }
        return  new Promise( resolve => {
            this.checker.check( this.collector.blocks, ( checkResult, error) =>{
                let news = checkResult?.news;
                resolve( { result: !!error && news?.length > 0, error } );
            }, line);
        });
    }

    // Coleta os blocos de revisão
    public collect():{
        error?:Error,
        collected?:RevisionPatch<P>[]
        revisions?:RevisionPatch<P>[]
    } {
        this.notify("log", LogLevel.Info, "Collecting revision blocks.");
        this.clean();
        let collectResult =  this.patchCollector.collect();
        this.notify("collect", this.patchCollector.blocks );
        return collectResult;
    }

    on<K extends keyof RevisionEventListener<P>>(event: K, callback: RevisionEventListener<P>[K]) {
        super.on(event, callback);
        if( event === "revision" && this.lastResult ){
            let _callback:RevisionEventListener<P>["revision"] = callback as RevisionEventListener<P>["revision"];
            _callback( this.lastResult.error, this.lastResult.blocks );
        }
    }

}
