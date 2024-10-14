import fs from "fs";
import Path from "path";

export const DEFAULTS_MAP = [ "HKLM\\SOFTWARE\\PostgreSQL", "HKCU\\SOFTWARE\\PostgreSQL" ] as const;
export type KnowMaps = typeof DEFAULTS_MAP[number];

export type PgService = {
    type: 'Services',
    entry: string,
    path: string,
    data: string,
    port: number,
    superuser: string,
    DisplayName: string,
    Locale: 'Portuguese_São Tomé & Príncipe.1252',
    ProductCode: 'postgresql-x64-13',
    ServiceAccount: 'NT AUTHORITY\\NetworkService',
    service: 'postgresql-x64-13',
    versionNumber:number
    versionCode:string
}

export type PgInstallation = {
    type: 'Installations',
    entry: string,
    path: string,
    installation: string,
    versionCode: string,
    version: string,
    CLT_Version: string,
    data: string,
    pgAdmin_Version: string,
    SB_Version: string,
    ServiceAccount: string,
    ServiceID: string,
    superuser: string,
    versionNumber:number

}

type ScanProcess = {
    // pendents:number,
    installations:PgInstallation[],
    services:PgService[],
    // regedit:import( "regedit" ),
    complete()
    start()
};

function createProcess( callback:()=>void ):ScanProcess{
    let pendents = 0;
    const regedit = require( "regedit" )
    return {
        start() {
            pendents++
            return regedit;
        },
        complete:()=>{
            pendents--;
            if( pendents === 0 ) callback();
        },
        installations: [],
        services: []
    }
}

function mapEntry ( proc:ScanProcess, location:"Services"|"Installations", path:string, entryKey: string){

    let map = path.split("\\");
    map.push( entryKey );
    proc.start().list( map.join( "\\" ) ).on( "data", ( entry )=>{
        if( !entry.data.exists ) return;

        let map = location==="Installations"? [
            "Base Directory", "installation",
            "Branding", "versionCode",
            "Version", "version",
            "CLT_Version", "CLT_Version",
            "Data Directory", "data",
            "pgAdmin_Version", "pgAdmin_Version",
            "SB_Version", "SB_Version",
            "Service Account", "ServiceAccount",
            "Service ID", "ServiceID",
            "Super User", "superuser",
            "Super User", "superuser",
        ]: location === "Services" ? [
            "Data Directory", "data",
            "Port", "port",
            "Database Superuser", "superuser",
            "Display Name", "DisplayName",
            "Locale", "Locale",
            "Product Code", "ProductCode",
            "Service Account", "ServiceAccount",
            "Service Account", "ServiceAccount",
        ]: [];

        const values = entry.data.values;



        const reg:any = {
            type: location,
            entry: entryKey,
            path: entry.key,
        };

        for (let i = 0; i < map.length; i+=2 ) {
            let key = map[ i+1 ];
            let code = map[ i ];
            reg[ key ]  = values?.[ code ]?.[ "value" ];
        }

        if( location === "Services" ){
            let service:PgService = reg;
            if( !service.path ) return;
            if( !service.entry ) return;
            if( !service.port ) return;
            if( !service.superuser ) return;
            if( fs.existsSync( Path.join( service.data, "PG_VERSION" ) ) ){
                service.versionNumber = Number(fs.readFileSync(Path.join(service.data, "PG_VERSION")).toString().trim());
            }
            if( Number.isNaN( service.versionNumber ) || !Number.isFinite( service.versionNumber ) || !Number.isSafeInteger( service.versionNumber ) ){
                service.versionNumber = null;
            }
            service.versionCode = service.DisplayName;
            proc.services.push( service );
        }
        else if( location === "Installations" ){
            let installation:PgInstallation = reg;
            if( !installation.version ) return;
            if( !installation.entry ) return;
            if( !installation.path ) return;
            if( !installation.versionCode ) return;
            installation.versionNumber = Number( installation.version.split(".")[0].trim());
            if( Number.isNaN( installation.versionNumber ) || !Number.isFinite( installation.versionNumber ) || !Number.isSafeInteger( installation.versionNumber ) ){
                installation.versionNumber = null;
            }
            proc.installations.push( installation );
        }

    }).on( "finish", ()=>{
        proc.complete();
    })

}

function findLocation  ( proc:ScanProcess, path:string, location:"Services"|"Installations" ){
    let map = path.split("\\");
    map.push( location );
    proc.start().list( map.join( "\\" ) ).on( "data", ( entry )=>{
        if( !entry.data.exists ) return;
        [ ...entry.data.keys].forEach( entryName => {
            mapEntry( proc, location, entry.key, entryName  )
        });
    }).on( "finish", ()=>{
        proc.complete();
    })

}

//[ 'HKLM\\SOFTWARE\\PostgreSQL', 'HKCU\\SOFTWARE\\PostgreSQL'


export type ScanPostgresRegistersResult = {
    installations:PgInstallation[]
    services:PgService[],
    minVersion:number,
    maxVersion:number,
    versions:number[]
}

export function lookupPostgresRegister( response:( result:ScanPostgresRegistersResult, error?:Error )=>void){
    let knowsMaps:KnowMaps[ ] = [];
    if( !knowsMaps ) knowsMaps = DEFAULTS_MAP.map( value => value );
    knowsMaps = DEFAULTS_MAP.filter( value => knowsMaps.includes( value ) );
    if( !knowsMaps.length ) knowsMaps = DEFAULTS_MAP.map( value => value );


    const proc = createProcess( () =>   {
        let sets = new Set<number>();
        proc.installations.forEach( value => sets.add( value.versionNumber ) );
        let versions:number[] = [...sets].sort( (a, b) => a-b );

        response({
            installations: proc.installations,
            services: proc.services,
            versions: versions,
            maxVersion: versions[ versions.length -1],
            minVersion: versions[ 0 ]
        })
    })
    proc.start().list( [ ...knowsMaps ]  ).on( "data", ( entry )=>{
        if( !entry.data.exists ) return;
        [ ...entry.data.keys ].forEach( location => {
            findLocation( proc, entry.key, location  )
        });
    }).on( "finish", ()=>{
        proc.complete()
    });
}
