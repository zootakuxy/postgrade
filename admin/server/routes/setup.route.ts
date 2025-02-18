import {context} from "../context/index";
import Path from "path";
import fs from "fs";
import {app} from "../services/web";
import {Configs, Notified, SetupReturns} from "../../../libs/postgrade";
import {
    InstallationLocation,
    PgCore,
    PostgresContext,
    PostgresInstanceOptions,
    RevisionCore,
    scriptUtil,
    sql
} from "kitres";
import {execSync} from "node:child_process";
import dao from "../services/database/pg/index";
import {Pool} from "pg";
import chalk from "chalk";
import {VERSION} from "../../../version";

const psql = execSync( "which psql" ).toString().trim();

fs.mkdirSync( Path.join( context.env.SETUP, "setups" ), { recursive: true } );
// fs.chmodSync( Path.join( context.env.SETUP, "setups" ), "777")

app.post( "/api/admin/setup/:app", (req, res ) => {
    let destination = Path.join( context.env.SETUP, "setups", req.params.app );
    // /etc/postgrade/helpdesk/setup.json
    let configsFile = Path.join( destination, "setup.json" );

    let notified:Notified[] = [];

    let respond = ( error:Error, message:string, hint?:any, response?:SetupReturns )=>{
        if( !response?.result && !error ) console.log( context.tag, `Response for setup`, req.path, response );
        if( !response ){
            response = {
                result: false,
                messageError: error?.message,
                message: message || "Database setup error",
                hint: hint,
            }
        }
        res.json({
            ...response,
            notified: notified
        });
        return;
    }
    if( !fs.existsSync( configsFile ) ){
        respond( new Error( `Setup configs not exists!` ), `Setup configs not exists!`, configsFile );
        return;
    }

    let configs:Configs;
    try { configs = JSON.parse( fs.readFileSync( configsFile ).toString() ); }catch (e){
        return respond( new Error( "Invalid setup configs file" ),"Invalid setup configs file")
    }

    configs.database.forEach( database =>  {
        if( !database.extensions.includes( "http" ) ) database.extensions.push( "http" );
        database.base = Path.join( destination, database.base );
        database.setups.forEach( (setup) => {
            setup.filename = Path.join( destination, setup.filename );
        });
    });

    configs.hba.forEach( hba => {

    });

    configs.users.forEach( user => {
        user.tests.forEach( test => {
        });
    });


    let setupOption:PostgresInstanceOptions = {
        configs:{
            port: context.env.POSTGRES_PORT,
            hba: configs.hba,
            database: configs.database,
            users: configs.users,
            listenAddress: "*",

        }, superuser: {
            username: context.env.POSTGRES_SUPERUSER,
            password: context.env.POSTGRES_PASSWORD,
            superuser: true
        }, init: {
            auth: "md5",
            encoding: "utf8",
            noLocale: true
        },
        installerLocation: InstallationLocation.REMOTE,
        clusterLocation: InstallationLocation.REMOTE,
        service: context.env.SERVICE,
        serverHost: context.env.POSTGRES_HOST,
        cluster: context.env.POSTGRES_CLUSTER,
        cli: {
            psql: psql
        }
    };


    let setup = ( returns:( error?:Error, respond? :SetupReturns)=>void )=>{
        let sets = new PostgresContext( setupOption )
        sets.on( "log", (level, message) => {
            console.log( `database setup log ${level} > ${ message.trim() }`);
            notified.push( { event: "log", text: message, args:{ level }});
        });
        sets.on("message", (message, action) => {
            console.log( `database setup message > ${ message.trim() }` );
            notified.push( { event: "message", text: message, args:{ action }});
        });

        sets.on( "setup",(error, result) => {
            let message:string;
            if( error ) message = ( `Database preparation Error | ${ error.message }` );
            else if( !result.status) message = ( "Database preparation failed!" )
            else  message =( `Database setup > Database prepared successfully!` )
            notified.push( { event: "setup", text: message, args:{ result }});
            return console.log( context.tag, message );
        });

        sets.on( "flowResolved", (flow, preview) => {
            let message = `Database setup flow resolved > Resolved database preparation flow ${ flow.identifier } in steep ${ flow.steep } out with ${ flow.out } | ${ flow?.response?.message }`;
            notified.push( { event: "flowResolved", text: message, args:{ flow: flow.identifier, preview: preview?.identifier }});
            console.log( context.tag, message );
            if( flow.error ){
                console.error( context.tag, flow.error );
            }
        });

        sets.on( "flowSkip", (steep, flow) => {
            let message = `Database setup flow skipped> Skipped database preparation flow ${ flow.identifier } in steep ${ steep }`;
            notified.push( { event: "flowResolved", text: message, args:{ flow: flow.identifier, steep: steep }});
            console.log( context.tag, message );
        });


        sets.setup( ( error, result) => {
            if( error ) {
                console.error( context.tag, `Error ao efetuar o setup da base de dados!`, error );
                return respond( error,  `Error ao efetuar o setup da base de dados` );
            }
            return returns( error, {
                result: result?.status,
                message: `Error ao efetuar o setup da base de dados`,
                setups: result,
                notified: notified
            })
        });
    }

    let revision = ( returns:( error?:Error )=>void )=>{
        let promises = configs.database.map( database => {
            let owner =  configs.users.find( user => database.owner === user.username );
            if( !owner ) return;

            return new Promise<{error?:Error}>(( resolve )=>{
                let core = new PgCore( () => new Pool( {
                    user: owner.username,
                    database: database.dbname,
                    password: owner.password,
                    host: context.env.POSTGRES_HOST,
                    port: context.env.POSTGRES_PORT
                }), { schema: "postgrade" });

                const revision = new RevisionCore( connection => {
                    return core
                });
                listener( revision, core );
                let collection = revision.collect();
                if( collection.error ){
                    console.log( context.tag, `Error ao collectar revisões!` );
                    return resolve({ error: collection.error })
                }

                revision.setup( (error, block) => {
                    if( error ){
                        console.log( context.tag, `Error ao aplicar a revisão ininical!`, error );
                        return resolve({ error });
                    }
                    resolve( { error:null })
                });
            });
        }).filter( value => !!value );

        Promise.all( promises ).then( value =>  {
            let error = value.find( value1 => value1.error );
            if( error ) return returns( error.error );
            return  returns( null )
        }).catch( reason => {
            returns( reason );
        });

    }

    let reload=( returns:(error?:Error)=>void )=>{
        dao.core.query( sql`
          select * from pg_reload_conf()
        `, (error, result) => {
            if( error ){
                console.error( context.tag, `Error reloading configs`, error );
                return returns( error );
            }
            returns( error );
        });
    }

    hba( configs );
    reload( error => {
        if( error ) return respond( error, 'Falha ao recarregar as configurações base do db' );
        setup( ( error, returns) => {
            if( error ) return respond( error, 'Error ao efetuar os setups base do banco!');
            if( !returns.result ) return respond( null, 'Falha ao efetuar os setups base do banco!', returns.hint )

            revision( error => {
                if( error ) respond( error, 'Error ao aplicar as revisões inicial da base de dados!' );
                return respond( null, 'Success', null, {
                    result: true,
                    message: "Success",
                    setups: returns.setups,
                })
            })
        })
    })




})


function hba( opts:Configs ){
    let update = ( filename:string, raw:string, lines:string[])=>{
        if( lines.length ){
            let scripts  = `
                ${ raw }
                #=================== ${ new Date().toISOString() } ==================
                ${ lines.join("\n")}
                #===================                               ==================
                `.split( "\n" )
                .map( value => value.trim() )
                .filter( value => value.length )
                .join( "\n" )
            ;
            fs.writeFileSync( Path.join( context.env.POSTGRES_CLUSTER, filename ), scripts, );
        }
    }

    let lines:string[] = [];
    let raw = fs.readFileSync( Path.join( context.env.POSTGRES_CLUSTER, "pg_hba.conf" ) ).toString();
    let hba = raw.split( "\n" )
        .map( (line, index ) => {
            if( !line.trim().startsWith( "#" ) ) return null;
            let parts = line.split( " " )
                .map( value1 => value1.trim() )
                .filter( value1 => value1.length );
            if(!["local", "host"].includes( parts[0]) )  return null;
            if( parts[0] === "local" && parts.length !== 4) return null;
            if( parts[0] === "host" && parts.length !== 5) return null;
            let TYPE:string, DATABASE:string, USER:string, ADDRESS:string, METHOD:string;

            if( parts[0] === "local" ){
                [ TYPE, DATABASE, USER, METHOD ] =parts;
            } else if( parts[0] === "host"){
                [ TYPE, DATABASE, USER, ADDRESS, METHOD ] =parts;
            }

            if( !TYPE ) return null;
            if( !DATABASE) return null;
            if( !USER) return  null;
            if( !METHOD) return null;

            return {
                TYPE, DATABASE, USER, ADDRESS, METHOD, index
            }
        }).filter( value => {
            return !!value;
        });

    opts.hba.forEach( value => {
        if ( value.address === "*" ) value.address = "0.0.0.0/0";
    });

    opts.hba.filter( news => {
        if( news.address === "*" ) news.address = "0.0.0.0/0";
        let find = hba.find( current => {
            return current.TYPE === news.type
                && current.DATABASE === news.database
                && current.USER === news.user
                && current.METHOD === news.method
                && (current.ADDRESS === news.address || (!current.ADDRESS && !news.address))
        });
        return !find;
    }).forEach( value => {
        //# TYPE  DATABASE        USER            ADDRESS                 METHOD
        lines.push( `${value.type }    ${ value.database }    ${ value.user }    ${ value.address?value.address:"" }    ${ value.method }` );
    });

    update( "pg_hba.conf", raw, lines );
}


function listener ( rev:RevisionCore<any>, core:PgCore){
    rev.setsOptions({
        dirname: Path.join( __dirname, /*language=file-reference*/ `../../database/revs` ),
        schema: core.schema,
        VERSION: VERSION as any,
        resolvedDirectory: Path.join( __dirname, /*language=file-reference*/ `../../database/revs/resolved` ),
        history: false,
        props: {
            DATA_VERSION: VERSION.TAG
        }
    })

    rev.on("log", (level, message) => {
        // console.log( message );
    });

    rev.on("collectError", error =>{
        console.error( context.tag, error );
    });

    rev.on( "register", block => {
        // console.log( block )
        let filename = scriptUtil.typescriptOf( block.filename ) || block.filename;
        let lineNumber = block.line?.line as any;
        if( lineNumber ) lineNumber = `:${ lineNumber }`;
        console.log( `collecting database patch ${ new URL(`file:\\\\${ filename }${lineNumber}`).href } identifier = "${ block.identifier }"` );
    });

    rev.on( "applierNotice", notice => {
        let filename = scriptUtil.typescriptOf( notice.filename )||notice.filename;
        let lineNumber = notice.line?.line as any;
        if( lineNumber ) lineNumber = `:${ lineNumber }`;
        else lineNumber = ':1';
        let status = chalk.blueBright.bold( notice.status );
        if( notice.status === "ERROR" ) status = chalk.redBright.bold( notice.status );
        if( notice.status === "FINALIZED" ) status = chalk.green.bold( notice.status );
        console.log( `apply database path ${ new URL( `file:\\\\${ filename }${ lineNumber }` ).href } identifier = "${ notice.identifier }" ${ status }`);
    });
}

console.log( "Loaded route file", __filename );