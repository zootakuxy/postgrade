import fs from "fs";
import ini from "ini";
import Path from "path";
import {EnvArgsOptions} from "./lib/utils/env";
export type EnvMode = "dev" | "test" | "prop" | "public";

export class EnvOptions {
    NAME: string =  "POSTGRADE"
    MODE: EnvMode = "dev"
    CONFIGS: string = "/etc/postgrade/main.conf"
    SETUP: string = "/postgrade/setups"

    POSTGRES_CLUSTER: string  = "/var/lib/postgresql/data"
    POSTGRES_NAME: string = "postgres"
    POSTGRES_SUPERUSER: string = "postgres"
    POSTGRES_PASSWORD: string = null
    POSTGRES_HOST: string = "127.0.0.1"
    POSTGRES_VERSION:  number = 14
    POSTGRES_PORT: number = 5432
    POSTGRES_SERVICE: "postgresql.service"

    SERVER_PORT: number = 3000
    SERVER_INTERNAL: number = 4444
    SERVER_PROTOCOL: "http"|"https" = "http"

    MAIL_PASSWORD: string
    MAIL_HOSTNAME: string = null
    MAIL_NAME: string = null
    MAIL_MAIL: string = null
    MAIL_PORT: number = null
}

const definition:{[ K in keyof EnvOptions ]?:Parser } = {
    MAIL_PORT: value => _as.integer( value ),
    SERVER_PORT: value  => _as.integer( value ),
    POSTGRES_VERSION: value  => _as.integer( value ),
    POSTGRES_PORT: value  => _as.integer( value ),
    MAIL_PASSWORD: (value, origin, configFile) => _as.password( value, origin, configFile),
    POSTGRES_PASSWORD:(value, origin, configFile) => _as.password( value, origin, configFile),
}

type Parser = ( value:string, origin:Origin, configFile?:string )=>any

export type Env = {
    [K in `POSTGRADE_${keyof EnvOptions}`]:EnvOptions[ K extends `POSTGRADE_${infer R}`? R: never ]
}


type Origin = "options"|"env"|"configs"|"default";


class Password {
    type:"unresolved"| "plain" | "raw" | "unknown" | "file" | "url"
    direction:string
    resolved:string
    constructor( opts?:Partial<Password> ) {
        Object.entries( opts||{} ) .forEach( ([key, value]) => {
            this[key] = value
        });
        if( !this.type && !this.direction && !this.resolved ) this.type = "unresolved";
        if( !this.type ) this.type = "unknown";
    }

    static instance( opts?:Partial<Password> ){
        return new Password( opts );
    }
}

let resolveFile = ( entry:string, origin:Origin, configFile?:string )=>{
    if( Path.isAbsolute( entry ) ) return entry;
    let from = Path.dirname( configFile );
    if( origin === "configs") return Path.join( from, entry );
    return Path.join( process.cwd(), entry );
}

const _as = {
    boolean( s: string ) {
        if( s === undefined || s === null ) return false;
        let num = Boolean( s );
        return !!num;
    },
    number( s: string ) {
        if( s === undefined || s === null ) return null;
        let num = Number( s );
        if( Number.isNaN( num ) ) return null;
        return num;
    },
    password( s: string, origin:Origin, configFile?:string) {
        if( !s ) return Password.instance();
        if( typeof s !== "string" ) return Password.instance();

        let parts = s.split(":");
        if( parts.length < 2 ) return Password.instance({ resolved: s, type: "raw" });

        let type = parts.shift() as Password["type"];
        let direction = parts.join( ":" );
        if( [ "plain", "raw" ].includes( type ) ) return Password.instance({
            type: type,
            resolved: direction,
            direction: "plain"
        });

        if( type === "file" ){
            let file = resolveFile( direction, origin, configFile );
            if(  (!fs.existsSync( file ) || !fs.statSync( file ).isFile())) return Password.instance({
                type: type,
                resolved: null,
                direction: file
            })
            let resolved = fs.readFileSync( file ).toString();
            return  Password.instance( {
                type: type,
                resolved: resolved,
                direction: file
            })
        }
    },
    integer( s: string ){
        let num = this.number( s );
        if( !Number.isSafeInteger( num ) ) return null;
        return num;
    }
}


const extractor = {
    options( ENV:string, props:string, options:any ){
        if( !!options && options[ props ] !== null && options[ props ] !== undefined ) return options[ props ];
    },
    env( ENV:string, props:string, options:any ){
        return process.env[ ENV ];
    }
}

const defaults = new EnvOptions()

type Failure = ({
    ENV:keyof EnvOptions,
    message:string
});
const extract = ( key:string, props:string[], configsFile:any, source:any, origin:Origin,  )=>{
    let use = origin === "options"? props.map( value1 => value1.toLowerCase() ).join( "." )
        : origin === "env"? [ "POSTGRADE", ...props ].join( "_" )
        : origin === "configs"? key
        : origin === "default"? key
        : undefined;
    let extracted = source[ use ];
    let value = extracted;
    let parser:Parser= definition[ key ];
    if( typeof parser === "function" ) {
        value = parser( extracted, origin, configsFile );
    }
    if ( key === "POSTGRES_PASSWORD" ){
        console.log({key, origin, use, extracted, value, source })
    }

    return value;
}

function hasValue( key:string, val: any) {
    if( val === null || val === undefined ) return false;
    return !( val instanceof Password && !val.resolved );

}

export function environments( options?:Partial<ArgsOptions> ){
    let failures:Failure[] = [];
    options = options || {};
    let configsFile = options["configs"] as string
        || process.env[ "POSTGRADE_CONFIGS" ]
        || defaults.CONFIGS;

    let configs:EnvOptions = {} as EnvOptions;
    if( fs.existsSync( configsFile ) && fs.statSync( configsFile ).isFile() ) {
        configs = ini.parse( fs.readFileSync( configsFile ).toString() ) as EnvOptions;
    }


    let use = new EnvOptions();

    Object.entries( defaults ).forEach( ( [ key, value ] ) => {
        let props = key.split( "_" );
        let val =                         extract( key, props, configsFile,  options, "options" );
        if( !hasValue( key, val ) ) val = extract( key, props, configsFile, process.env, "env" );
        if( !hasValue( key, val ) ) val = extract( key, props, configsFile, configs, "configs" );
        if( !hasValue( key, val ) ) val = extract( key, props, configsFile, defaults, "default" );
        use[ key ] = val;

        if( val instanceof Password) {
            use[ key ] = val.resolved;
            if( !val.resolved || val.type === "unresolved" ) failures.push({
                ENV: key as any,
                message: `Unresolved env props:${key} with direction: ${ val.direction }`
            })
        }
    });
    return { env: use, failures };
}

export type ArgsOptions = Partial<EnvArgsOptions<EnvOptions>>









