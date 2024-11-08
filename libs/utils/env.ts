
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



export function environments<EV>( EVClass, definition, options?:Partial<ArgsOptions<EV>> ){
    let failures:Failure<EV>[] = [];
    let defaults = new EVClass();

    options = options || {};
    let configsFile = options["configs"] as string
        || process.env[ "CONFIGS" ]
        || defaults.CONFIGS;

    let configs:EV = {} as EV;
    if( fs.existsSync( configsFile ) && fs.statSync( configsFile ).isFile() ) {
        configs = ini.parse( fs.readFileSync( configsFile ).toString() ) as EV;
    }


    let use:EV = new EVClass();

    Object.entries( defaults ).forEach( ( [ key, value ] ) => {
        let props = key.split( "_" );
        let val =                         extract( definition, key, props, configsFile,  options, "options" );
        if( !hasValue( key, val ) ) val = extract( definition, key, props, configsFile, process.env, "env" );
        if( !hasValue( key, val ) ) val = extract( definition, key, props, configsFile, configs, "configs" );
        if( !hasValue( key, val ) ) val = extract( definition, key, props, configsFile, defaults, "default" );
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
    return !( val instanceof Password && !val.resolved );

}

export type EnvParser = ( value:string, origin:Origin, configFile?:string )=>any



export type ArgsOptions<EV> = Partial<EnvArgsOptions<EV>>