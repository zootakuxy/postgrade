import {QueryBuilderResult, RevisionCore, sql} from "../pg-core";
import {RevisionListener, SimpleFile, RegistryOptions} from "./index";
import {ScriptLine, scriptUtil} from "../../util";


export type PatchOptions<P> = RegistryOptions<P> & {
    module?: NodeModule | SimpleFile
}
export class SqlPatch <R,N, P>{
    opts:RegistryOptions<P> & PatchOptions<P>
    str: string | QueryBuilderResult;
    values: any[] | RevisionListener;
    listener?: RevisionListener;
    line:ScriptLine

    constructor(opts: PatchOptions<P>, str: string | QueryBuilderResult, values: any[] | RevisionListener, listener: RevisionListener) {
        this.opts = opts;
        this.str = str;
        this.values = values;
        this.listener = listener;
    }
}

export type SqlPatchDynamicCallback<T> = <R,N,P>( opts:T, core:RevisionCore<T>) => SqlPatch<R,N,P>|QueryBuilderResult;
export class SqlPatchDynamic<R,N, P> {
    public callback:SqlPatchDynamicCallback<P>
    constructor( callback:SqlPatchDynamicCallback<P>) {
        this.callback = callback;
    }
}

export function patch <R,N,P>( opts:PatchOptions<P>, str: string | QueryBuilderResult, values?: any[] | RevisionListener, listener?: RevisionListener) {
    if( typeof str === "string" && !str.trim() ){
        throw new Error( "Invalid string query is empty" );
    }
    let line  = scriptUtil.lineOf( 1 );
    let path=  new SqlPatch<R,N, P>( opts, str, values, listener );
    path.line = line;
    return path;
}

type PatchSQLResult<R,N, P>= {
    sql?(template, ...values):SqlPatch<R, N, P>
} & (( template:TemplateStringsArray, ...values )=>SqlPatch<R, N, P>)

export function patchSQL<R,N,P>( opts?:PatchOptions<P>, listener?: RevisionListener ):PatchSQLResult<R,N, P>{
    let callback:PatchSQLResult<R,N, P> =  ( template:TemplateStringsArray, ...values )=>{
        return patch<R,N, P>( opts, sql( template, ...values ), listener );
    };
    callback.sql = callback;
    return callback;
}

export function dynamicSQL<T>( callback:SqlPatchDynamicCallback<T> ){
    return new SqlPatchDynamic( callback );
}