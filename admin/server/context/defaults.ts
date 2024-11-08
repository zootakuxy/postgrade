import path from "path";
import Path from "path";



export const DefaultsEnvObject ={
    app:{
        name: "Luma" as string| undefined
    },
    flocoto:{
        isolated: true as undefined | boolean,
        application:[] as string[]
    },

    directory:{
        var: "./var" as string|undefined
    },

    server:{
        srvSessionMaxCookieAge: 999999 as number,
        srvSessionSecrete: "1234",
        srvPort:8888 as number,
        srvProtocol: "http" as "http"|"https",
    },

    cpanel: {
        autoCheckupTimer: 3600000,
        server: `https://flocoto.test.brainsoftstp.com`,
    },

    email:{
        name:"Flocoto",
        host:"mail.domain",
        port:25,
        email:"mail",
        pwd:"***Secrete***"
    },

    database:{
        dbHost: process.env.DATABASE_HOSTNAME || "127.0.0.1",
        dbPort:5432,
        dbPassword:"***Secrete***",
        dbName:"flocoto",
        dbUser:"flocoto",
        dbSuperuser:"postgres",
        dbSuperuserPassword:"***Secrete***"
    }
}


export const DefaultsEnvProps = {
    mode: "dev" as "dev"|"public"|"prod"|"test"|undefined,
    env: "/env" as undefined | string
}


export const Defaults = {
    /*language=file-reference*/
    ENV: Path.join( __dirname, "../../etc/entry.conf" ),
    APP_ROOT : path.join( __dirname, /*language=file-reference*/ '../../' ),
    ...DefaultsEnvProps,
    ...DefaultsEnvObject
}