import {context} from "../context/index";
import Path from "path";
import fs from "fs";
import {api} from "../services/web";
import {Configs} from "../../../libs/postgrade";
import {InstallationLocation, PostgresContext, PostgresInstanceOptions, sql} from "kitres";
import {execSync} from "node:child_process";
import dao from "../services/database/pg/index";

const psql = execSync("which psql").toString().trim();

api.get( "/api/admin/setup/:setup", (req, res ) => {
    console.log( JSON.stringify( context.env, null, 2 ))
    let configsFile = Path.join( context.env.SETUP, req.params.setup, "setup.json" );
    if( !fs.existsSync( configsFile ) ){
        res.json({
            result: false,
            message: `Setup configs not exists!`,
            configsFile
        });
        return;
    }

    let configs:Configs;
    try { configs = JSON.parse( fs.readFileSync( configsFile ).toString() ); }catch (e){
        res.json({
            result: false,
            message: "Invalid setup configs file"
        })
        return;
    }

    configs.database.forEach( database =>  {
        if( !database.extensions.includes( "http" ) ) database.extensions.push( "http" );
        database.setups.forEach( setup => {
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
        service: context.env.POSTGRES_SERVICE,
        serverHost: context.env.POSTGRES_HOST,
        cluster: context.env.POSTGRES_CLUSTER,
        cli: {
            psql: psql
        }
    };

    let setup = new PostgresContext( setupOption )

    setup.on( "log", (level, message) => {
        console.log( `database setup log ${level} > ${ message.trim() }`);
    });
    setup.on("message", (message, action) => {
        console.log( `database setup message > ${ message.trim() }` );
    });

    setup.on( "setup",(error, result) => {
        if( error ) return console.log( `Database preparation Error | ${ error.message }` );
        else if( !result.status) return console.log( "Database preparation failed!" )
        else return  console.log( `${ context.tag } database setup > Database prepared successfully!` )
    });

    setup.on("flowResolved", (flow, preview) => {
        console.log( `${ context.tag } database setup flow resolved > Resolved database preparation flow ${ flow.identifier } in steep ${ flow.steep } out with ${ flow.out } | ${ flow?.response?.message } `);
        if( flow.error ){
            console.error( context.tag, flow.error );
        }
    });

    setup.on( "flowSkip", (steep, flow) => {
        console.log( `${ context.tag } database setup flow skipped> Skipped database preparation flow ${ flow.identifier } in steep ${ steep }`)
    });

    let handler = ()=>{
        setup.setup( ( error, result) => {
            if( error ) {
                console.error( context.tag, `Error ao efetuar o setup da base de dados!` );
                return res.json( {
                    result: false,
                    message: `Error ao efetuar o setup da base de dados`,
                    hint: error.message,
                    setups: result
                })
            }
            return res.json({
                result: result?.status,
                message: `Error ao efetuar o setup da base de dados`,
                setups: result
            })
        });
    }

    hba( configs );
    dao.core.query( sql`
      select * from pg_reload_conf()
    `, (error, result) => {
        if( error ) return res.json({
            result: false,
            message: "Reload configs failed!",
        });
        handler();
    });
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