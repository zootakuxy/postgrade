import {DatabaseSetup, Grant, HBA, PgUser} from "kitres/src/core/database/instance";

export type Database = {
    dbname:string,
    extensions?:string[],
    newExtensions?:string[],
    extensionSchema?:string,
    schemas?:string[],
    search?:string[],
    owner:string,
    base?:string,
    grants?:Grant[],
    setups?:DatabaseSetup[]
}
export interface PostgradeConfigs {
    database?:Database[]
    users?:PgUser[],
    hba?:HBA[],
}