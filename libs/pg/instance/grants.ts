import {QueryBuilderResult, sql, SQL} from "kitres";
import {Database} from "./index";

export function grantsAllOnSchemaTo( schema:string, user:string ):QueryBuilderResult[]{
    return [
        sql`grant usage on schema ${SQL.identifier( schema ) } to ${ SQL.identifier( user )}`
        , sql`grant all privileges on all tables in schema ${SQL.identifier( schema ) } to ${ SQL.identifier( user )}`
        , sql`grant all privileges on all functions in schema ${SQL.identifier( schema ) } to ${ SQL.identifier( user )}`
        , sql`grant all privileges on all sequences in schema ${SQL.identifier( schema ) } to ${ SQL.identifier( user )}`
        , sql`grant all privileges on all routines in schema ${SQL.identifier( schema ) } to ${ SQL.identifier( user )}`
        , sql`grant all privileges on all procedures in schema ${SQL.identifier( schema ) } to ${ SQL.identifier( user )}`
    ]
}

export function grantsAllOnDatabaseTo( database:string, user:string ){
    return[
        sql`grant all on database ${SQL.identifier( database ) } to ${ SQL.identifier( user )}`,
        sql`grant all privileges on database ${SQL.identifier( database ) } to ${ SQL.identifier( user )}`
    ]
}

export function grantOnExpressionTo(database:Database ){
    return database.grants.map( grant => {
        return sql`grant ${ SQL.unsafe( grant.expression ) } ${ grant.object } to ${ grant.user }`;
    })
}