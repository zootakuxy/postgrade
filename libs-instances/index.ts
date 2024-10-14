export type Recognize = {
    location:string,
    version:number,
    versionSpecific:number,
    versionCode:string,
}

export type RecognizeCallback = ( recognize:Recognize[], error?:Error )=> void ;
export class PgServer {
    static recognizes( version:number, up:boolean, callback:RecognizeCallback ){

    }
}

export * from "./pg-ctl";
export * from "./pg-dump";
export * from "./pg-register";
export * from "../instance"