import {RevisionCore, RevisionPatch} from "./index";
import {QueryExecutor, Result, sql} from "../pg-core";
import {SQL} from "../pg-core";
import {CheckPatchArgs, DataVersion, NewPatch} from "./revision-applier";
import {LogLevel, ScriptLine} from "../../util";
import fs from "fs";
import Path from "path";


export class RevisionChecker<P> {
    private revCore:RevisionCore<P>;

    constructor( core:RevisionCore<P> ) {
        this.revCore = core;
    }

    private whenCheck(blocks:RevisionPatch<P>[], respond:(news:RevisionPatch<P>[], error?:Error )=>void){
        let whenPromise = [];
        let prefilter:{[p:string]:RevisionPatch<P>} = {}
        let hasError = [];

        blocks.forEach( block => {
            let accept = block.when === undefined
                || block.when === null
                || block.when === true;
            if( accept ) {
                prefilter[block.hash] = block;
                return;
            }

            if( typeof block.when === "function" ){
                let response = block.when( this.revCore.props );
                let reject = !response;
                if( reject ) return;
                prefilter[ block.hash ] = block;

                if( response instanceof Promise ) {
                    whenPromise.push( new Promise( resolve1 => {
                        (response as Promise<boolean>).then( value =>{
                            if( !value ){
                                delete prefilter[ block.hash ];
                            }
                            resolve1( value );
                        }).catch( reason => {
                            hasError.push( reason );
                        });
                        return;
                    }));
                }
            }
        });

        let acceptedBlocks = ()=>{
            return Object.values(prefilter).map((block) => {
                return block;
            });
        }

        //Return accepted blocks
        if( whenPromise.length ) {
            return Promise.all( whenPromise ).then( () => {
                if( hasError.length ) respond( null, hasError.shift() );
                respond( acceptedBlocks(), null )
            }).catch( reason => {
                respond( null, reason );
            });
        } return respond( acceptedBlocks(), null );
    }
    private newsCheck(blocks:RevisionPatch<P>[], respond:( response:{
        news?:RevisionPatch<P>[],
        currentVersion:DataVersion
    }, error?:Error)=>void){
        let revs =  blocks.map((block) => ({
            patch_identifier: block.identifier,
            patch_source: block.source,
            patch_unique: block.unique,
            patch_flags: block.flags,
            script_force: block.force,
            script_sql: block.script,
        }));


        this.checkPatches(
            {
                VERSION: this.revCore.options.VERSION.VERSION_CODE,
                patches: revs,
            },
            ( error, newsRev) => {
                if ( error) {
                    respond(null, error );
                    this.revCore.notify(
                        "log",
                        LogLevel.Error,
                        `Error checking patches: ${error.message}`
                    );
                    return;
                }

                let version:DataVersion = (newsRev.shift()) as any;

                if (!newsRev.length) {
                    return respond({
                        currentVersion: version,
                        news: []
                    }, null );
                }

                let newsPatch = blocks.filter( patch => {
                    return newsRev.find( change => {
                        return change.patch_identifier === patch.identifier
                            && change.patch_source === patch.source
                            && change.apply
                    });
                })

                respond( {
                    currentVersion: version,
                    news: newsPatch
                }, null );
            }
        );
    }

    public check(blocks:RevisionPatch<P>[], respond:(response:{
        news?:RevisionPatch<P>[],
        currentVersion:DataVersion
    }, error?:Error)=>void, line:ScriptLine ){
        blocks.forEach( block => {
            if (!block.builder) {
                let prepared = QueryExecutor.prepare(
                    block.str,
                    block.values,
                    null,
                    line
                );
                let preparedQuery = prepared.builder.noParameterizedQuery();
                block.script = preparedQuery.query.trim();
                block.builder = prepared.builder;
            }
        })
        this.newsCheck( blocks, (news, error) => {
            if( error) return respond( null, error );
            this.whenCheck( news.news, (whenNews, error)=>{
                return respond({
                    news: whenNews,
                    currentVersion: news.currentVersion
                }, error );
            })
        })
        ;
    }

    private checkPatches(args:CheckPatchArgs, listener:(error:Error, newPatches:NewPatch[])=>void  ){
        let saveOn = Path.join(process.cwd(), "check-revision.json");
        let query = sql`
          select *
            from ${ SQL.identifier( this.revCore.schema ) }.check ( 
              ${ SQL.jsonb( args )}  
            )
        `;
        this.revCore.connectionOf().execute( query, {
            onResult(error: Error, result?: Result< any, any>) {
                if( error ) return listener( error, null );
                return listener( error, result.rows as NewPatch[] );
            }
        })
    }


}
