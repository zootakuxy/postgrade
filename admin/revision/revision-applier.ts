import {RevisionCore} from "./index";
import {QueryBuilderResult, queryJoin, sql} from "../pg-core";
import {SQL} from "../pg-core";
import {RevisionPatch} from "./index";
import fs from "fs";
import Path from "path";
import {Result} from "../pg-core";
import {AppVersion, ScriptLine} from "../../util";
import {Notice} from "../pg-core/notice";



export type CheckPatch = {
    patch_flags: string[ ],
    patch_identifier: string,
    patch_source: string,
    patch_unique: boolean,
    script_force: string,
    script_sql: string
}

export interface CheckPatchArgs {
    VERSION:string,
    patches:CheckPatch[]
}

let sampleCanSetup = ({ "apply": true, "exists": 0, "script_sql": "select now()", "patch_source": "/datacore/core/structure.sql.ts", "patch_unique": "true", "script_force": "data-core-002", "patch_identifier": "data-core-002" });
let sampleVersion = (
    {
        "version_id": 2,
        "version_code": "\"sddsdsdsd\"",
        "version_weight": [1, 2, 3, 4],
        "version_revs": 1,
        "version_date": "2023-11-24 14:02:24.727320 +00:00",
        "version_last": "2023-11-07 14:02:19.738000 +00:00"
    }
);
export type NewPatch = typeof sampleCanSetup;
export type DataVersion = typeof sampleVersion;



export interface PatchApplierOptions {
    schema:string;
    DATA_VERSION:string;
}

export type RevisionApplierNoticeStatus = "STARTED"|"FINALIZED"|"ERROR";

function notifyBlock<P>( block:RevisionPatch<any>, status:RevisionApplierNoticeStatus, schema:string, iCounter?:number ){
    let notice:RevisionApplierNotice = {
        status: status,
        filename: block.filename,
        source: block.source,
        identifier: block.identifier,
        line: block?.line||block?.builder?.line||block?.str?.["line"]
    }
    let builder:QueryBuilderResult;
    if( !!iCounter ){
        builder =  sql`
          -- BLOCK iREGISTER: ${iCounter}
          select ${ SQL.identifier( schema ) }.notify( ${ SQL.text( JSON.stringify( notice ) ) } )
        `;

    } else {
        builder = sql`
          select ${ SQL.identifier( schema ) }.notify( ${ JSON.stringify( notice ) } )
        `;
    }
    builder.line = notice.line;
    if( !builder?.line ){
        throw new Error( `ScriptLine not declared!` );
    }
    return builder;
}

export interface RevisionApplierNotice {
    filename:string,
    source:string,
    identifier:string,
    status:RevisionApplierNoticeStatus,
    line:ScriptLine
}

export type ApplyOptions<P> = {
    blocks:RevisionPatch<P>[], lastFileName:string, nextFile:string, resolve:string
}

export class RevisionApplier<P> {
    private core: RevisionCore<P>;
    private _prepared:boolean;

    constructor( core:RevisionCore<P> ) {
        this.core = core;
    }

    public get isPrepared():boolean{
        return this._prepared;
    }

    public apply<R,N>( opts:ApplyOptions<P>, listener:(error:Error, blocks:RevisionPatch<P>[] )=> void ){
        if( !opts ) throw new Error( "Invalid parameters!" );
        let invalid = opts?.blocks?.find( value => !value
            || !value.source
            || !value.identifier
            || !value.filename
            || !value.script
        );
        if( !!invalid ) throw new Error("Error não esperado!" );

        let applicableBlocks:RevisionPatch<P>[] = opts.blocks;
        let lastFileName = opts.lastFileName;
        let resolve = opts.resolve;
        let nextFile = opts.nextFile;
        type GroupApplier = {
            connection:string,
            patches:RevisionPatch<P>[],
            resolves:QueryBuilderResult[]
        };

        const pathGroups:GroupApplier[] = [];

        applicableBlocks.forEach( block => {
            block.connection=  block.connection || "default";
            let last = pathGroups[ pathGroups.length-1 ];
            if( !last || last.connection !== block.connection ){
                last = {
                    connection: block.connection,
                    resolves: [],
                    patches: []
                };
                pathGroups.push( last );
            }


            last.patches.push( block );

            last.resolves.push( notifyBlock( block, "STARTED", this.core.schema, this.core.collector.orderOf( block) ));
            last.resolves.push( block.builder );
            last.resolves.push( this.prepareApply( {
                VERSION: this.core.options.VERSION.VERSION_CODE,
                patch_identifier: block.identifier,
                patch_source: block.source,
                patch_unique: block.unique,
                script_force: block.force,
                script_sql: block.script,
                patch_flags: block.flags
            }));
            last.resolves.push( notifyBlock( block, "FINALIZED", this.core.schema ))
        });

        let resolved:RevisionPatch<any>[]
        let _next = ( error?:Error, group?:GroupApplier  )=>{
            if( error || !group ){
                listener( error, resolved );
                return;
            }
            group.resolves.push( this.updateVersion( this.core.options.VERSION ) );
            let finalBuilder = queryJoin( ... group.resolves );
            let prepare = finalBuilder.noParameterizedQuery();
            fs.writeFileSync( lastFileName, prepare.query+`\n\n-- FILENAME: ${nextFile}` );
            let self = this;

            let notices:RevisionApplierNotice[] = [];

            this.core.connectionOf( group.connection ).execute<any, RevisionApplierNotice>( prepare.query, prepare.values||[], {
                onResult( error: Error, result?: Result<R, RevisionApplierNotice>) {
                    if( error ) {
                        fs.writeFileSync( Path.join( resolve, `${ nextFile }.failed.upgrade.sql` ), prepare.query );
                        return _next( error );
                    }
                    fs.writeFileSync( Path.join( resolve, `${ nextFile }.success.upgrade.sql` ), prepare.query );
                    if( !resolved ) resolved = [];
                    resolved.push( ...group.patches );
                    return _next( null, pathGroups.shift() )
                },
                onRow<R>(error: Error ) {
                    if( error ) return;
                },
                onNotice(error?: Error, message?: string, notice?: Notice<RevisionApplierNotice>) {
                    if( error ){
                        let last = notices[notices.length-1];
                        if( !last ) return;
                        last = JSON.parse( JSON.stringify( last ) );
                        if( last.status !== "STARTED" ) return;
                        last.status = "ERROR";
                        self.core.notify( "applierNotice", last );
                        return;
                    }
                    let applierNotice = notice.document;
                    if( !applierNotice ) return;
                    if( !applierNotice.status ) return;
                    if( !applierNotice.source ) return;
                    if( !applierNotice.filename ) return;
                    if( !applierNotice.identifier ) return;
                    notices.push( applierNotice );
                    self.core.notify( "applierNotice", applierNotice );
                }
            })
        }
        _next( null, pathGroups.shift() );
    }

    private prepareApply( args:CheckPatch&{VERSION:string}  ){
        return sql`
          select * from ${ SQL.identifier( this.core.schema ) }.apply (  ${ SQL.jsonb( args )} )
        `;
    }

    private updateVersion( version:AppVersion  ){
        return sql`
          select * from ${ SQL.identifier( this.core.schema ) }.version (  ${ SQL.jsonb( {
              version_code: version.VERSION_CODE,
              version_tag: version.TAG,
              version_revision: version.REVISION,
              version_name: version.NUMBER,
              version_GTAG: version.GIT_TAG,
              version_TREV: version.TAG_REV,
              version_weight: version.VERSION_WEIGHT
          })})
        `;
    }

}
