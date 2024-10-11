import {context} from "../context";
import Path from "path";
import fs from "fs";
import {app} from "../services/web";
import {PostgradeConfigs} from "../../libs/postgrade/PostgradeConfigs";
import {InstallationLocation, PostgresContext, PostgresInstanceOptions} from "kitres";

app.post("/api/admin/setup/:setup", (req, res) => {

})
app.post( "/api/admin/setup/:setup", ( req, res ) => {
    let configsFile = Path.join( context.env.SETUP, req.params.setup, "configs.json" );
    if( !fs.existsSync( configsFile ) ){
        res.json({
            result: false,
            message: `Setup configs not exists!`
        });
    }

    let configs:PostgradeConfigs;
    try { configs = JSON.parse( fs.readFileSync( configsFile ).toString() ); }catch (e){
        res.json({
            result: false,
            message: "Invalid setup configs file"

        })
        return;
    }

    fs.mkdirSync( `/tmp/postgrade`, {recursive: true});
    configs.database.forEach( database =>  {
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
    };

    let setup = new PostgresContext( setupOption )

    setup.on( "log", (level, message) => {
        console.log( `database setup log ${level} > ${ message.trim() }`);
    });
    setup.on("message", (message, action) => {
        console.log( `database setup message > ${ message.trim() }` );
    });

    setup.on(  "setup",(error, result) => {
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

    setup.setup( ( error, result) => {
        if( error ) {
            console.error( context.tag, `Error ao efetuar o setup da base de dados!` );
            return res.status( 400 )
                .json( {
                    result: false,
                    message: `Error ao efetuar o setup da base de dados`,
                    hint: error.message,
                    setups: result
                })
        }
        return res.status( 400 )
            .json({
                result: false,
                message: `Error ao efetuar o setup da base de dados`,
                hint: error.message,
                setups: result
            })
    });
})