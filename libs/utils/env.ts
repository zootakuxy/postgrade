
// Funções utilitárias
import fs from "fs";
import ini from "ini";
import Path from "path";

type Split<S extends string, D extends string> =
    S extends `${infer T}${D}${infer U}` ? [T, ...Split<U, D>] : [S];

// Função para capitalizar a primeira letra
type Capitalize<S extends string> =
    S extends `${infer First}${infer Rest}` ? `${Uppercase<First>}${Rest}` : S;

// Função para transformar uma string em camelCase
type CamelCase<S extends string> =
    S extends `${infer First}_${infer Rest}`
        ? `${Lowercase<First>}${Capitalize<CamelCase<Rest>>}`
        : Lowercase<S>;

// Tipo principal que une as partes em uma string com "."
type JoinWithDot<T extends string[]> =
    T extends [infer F, ...infer R]
        // @ts-ignore
        ? `${F & string}${R extends [] ? '' : `.${JoinWithDot<R>}`}`
        : '';

// Tipo que combina todas as operações
type Transform<S extends string> =
// @ts-ignore
    JoinWithDot<Split<S, "_"> extends infer U ? (U extends string[] ? { [K in keyof U]: CamelCase<U[K]> } : never) : never>;

// Extraindo as chaves da classe EnvOptions
type EnvOptionsKeys<EV> = keyof EV;

// Transformando as chaves em um tipo que segue a lógica desejada
export type EnvArgsOptions<EV extends {[K in keyof EV]:EV[K]}> = {
    // @ts-ignore
    [K in EnvOptionsKeys as K extends string ? Transform<K> : never]: (keyof EV)[K];
};


export type EnvDefinitions<EV extends { [ K in keyof EV]:EV[K]}> = {[ K in keyof EV ]?:EnvParser };
export type EnvDocumentations<EV extends { [ K in keyof EV]:EV[K]}> = {[ K in keyof EV ]?:{
    label? :string,
    descriptions?: string
    required?: boolean
    parse?:EnvParser
}};
export type ArgsOptions<EV> = Partial<EnvArgsOptions<EV>>
export type EnvOptions<EV extends { [ K in keyof EV]:EV[K]}> = Partial<ArgsOptions<EV>>


export function loadEnvs( ...envsFiles:string[]){
    envsFiles.forEach( filename => {
        if( !fs.existsSync( filename ) ) return;
        let envs = ini.parse( fs.readFileSync( filename ).toString() );
        Object.entries( envs ).forEach( ([key, value]) => {
            if( !!process.env[key] ) return;
            process.env[ key ] = value;
        });
    });
}

export type EnvironmentsOptions<EV> = {
    arguments?:EnvOptions<EV>,
    dotenvs?:string[]
}
export function environments<EV>( EVClass:new (...args: any[]) => EV, definition:EnvDefinitions<EV>, opts?: EnvironmentsOptions<EV> ){
    let failures:Failure<EV>[] = [];
    let defaults = new EVClass();
    if( opts?.dotenvs?.length ) loadEnvs( ...opts.dotenvs );
    let options = opts.arguments || {};
    let configsFile = options["configs"] as string
        || process.env[ "CONFIGS" ]
        || defaults[ "CONFIGS" ]
    ;

    let configs:EV = {} as EV;
    if( fs.existsSync( configsFile ) && fs.statSync( configsFile ).isFile() ) {
        configs = ini.parse( fs.readFileSync( configsFile ).toString() ) as EV;
    }


    let use = new EVClass();

    Object.entries( defaults ).forEach( ( [ key, value ] ) => {
        let props = key.split( "_" );
        let val =                    extract( definition, key, props, configsFile,  options, "options" );
        if( !hasValue( key, val ) ) val = extract( definition, key, props, configsFile, process.env, "env" );
        if( !hasValue( key, val ) ) val = extract( definition, key, props, configsFile, configs, "configs" );
        if( !hasValue( key, val ) ) val = extract( definition, key, props, configsFile, defaults, "default" );
        use[ key ] = val;

        if( val instanceof Password ) {
            use[ key ] = val.resolved();
            if( ( !val.resolved() || val.type === "unresolved" ) && val.is( "required" ) ) failures.push({
                ENV: key as any,
                message: `Unresolved env props:${key} with direction: ${ val.direction }`
            })
        } else if( val instanceof EnvValue ) {
            use[ key ] = val.resolved();
            if(( !val.resolved() === null || !val.resolved() === undefined ) && val.is( "required" )){

            }
        }
    });
    return { env: use, failures };
}


type EnvChecks = "required";

class EnvValue<T> {

    private _checks:Set<EnvChecks>
    private readonly _resolved:T;

    constructor( resolved:T ) {
        this._resolved = resolved;
        this._checks = new Set<EnvChecks>();
    }

    public resolved(){
        return this._resolved;
    }

    as( ...checks: EnvChecks[] ){
        checks.forEach( value => this._checks.add( value ));
        return this;
    }
    no( ...checks: EnvChecks[] ){
        checks.forEach( value => this._checks.delete( value ));
        return this;
    }

    is( ...checks: EnvChecks[]) {
        return !checks.find( value => !this._checks.has( value ));
    }
}

interface PasswordOptions  {
    type:"unresolved"| "plain" | "raw" | "unknown" | "file" | "url"
    hint?:string
    direction:string
}
class Password extends EnvValue<string> implements PasswordOptions {
    type:"unresolved"| "plain" | "raw" | "unknown" | "file" | "url"
    direction:string
    constructor( resolved:string, opts?:Partial<PasswordOptions> ) {
        super( resolved )
        Object.entries( opts||{} ) .forEach( ([key, value]) => {
            this[key] = value
        });
        if( !this.type && !this.direction && !this.resolved ) this.type = "unresolved";
        if( !this.type ) this.type = "unknown";
        this.as( "required" );
    }

    static instance( resolved?:string, opts?:Partial<PasswordOptions> ){
        return new Password( resolved, opts );
    }
}

type Origin = "options"|"env"|"configs"|"default";


let resolveFile = ( entry:string, origin:Origin, configFile?:string )=>{
    if( Path.isAbsolute( entry ) ) return entry;
    let from = Path.dirname( configFile );
    if( origin === "configs") return Path.join( from, entry );
    return Path.join( process.cwd(), entry );
}

export const EnvAS = {
    boolean( s: string ) {
        if( s === undefined || s === null ) return false;
        let num = Boolean( s );
        return new EnvValue( !!num );
    },
    number( s: string ) {
        if( s === undefined || s === null ) return null;
        let num = Number( s );
        if( Number.isNaN( num ) ) return null;
        return new EnvValue( num );
    },
    password( s: string, origin:Origin, configFile?:string) {
        if( !s ) return Password.instance(undefined, { hint:"raw value not sets" });
        if( typeof s !== "string" ) return Password.instance( undefined, { hint:"raw is not a strings" });

        let parts = s.split(":");
        if( parts.length < 2 ) return Password.instance( s, { type: "raw", hint:"Using raw value sets"  });

        let type = parts.shift() as Password["type"];
        let direction = parts.join( ":" );
        if( [ "plain", "raw" ].includes( type ) ) return Password.instance( direction, {
            type: type,
            direction: "plain",
            hint: "Password type is raw or plain"
        });

        if( type === "file" ){
            let file = resolveFile( direction, origin, configFile );
            if(  (!fs.existsSync( file ) || !fs.statSync( file ).isFile())) return Password.instance( null, {
                type: type,
                direction: file,
                hint: "Password type file not resolved file! File not exists!"

            })
            let resolved = fs.readFileSync( file ).toString();
            return  Password.instance( resolved, {
                type: type,
                hint: "Password type is file!",
                direction: file
            })
        }
    },
    integer( s: string ){
        let num = this.number( s );
        if( !num ) return null;

        if( !Number.isSafeInteger( num.resolved() ) ) return null;
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

type Failure <EV>= ({
    ENV:keyof EV,
    message:string
});
const extract = ( definition:any, key:string, props:string[], configsFile:any, source:any, origin:Origin,  )=>{
    let use = origin === "options"? props.map( value1 => value1.toLowerCase() ).join( "." )
        : origin === "env"? [ ...props ].join( "_" )
            : origin === "configs"? key
                : origin === "default"? key
                    : undefined;
    let extracted = source[ use ];
    let value = extracted;
    let parser:EnvParser= definition[ key ];
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
    if( val instanceof Password ) return val.resolved();
    if( val instanceof EnvValue ) return val.resolved();
    return true;
}

export type EnvParser = ( value:string, origin:Origin, configFile?:string )=>any
