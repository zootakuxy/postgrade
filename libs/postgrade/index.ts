import {Database, HBA, PgUser} from "kitres/src/core/database/instance";

export interface Index {
    database?:Database[]
    users?:PgUser[],
    hba?:HBA[],
}