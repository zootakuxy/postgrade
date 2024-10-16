import {Database, HBA, PgUser} from "kitres/src/core/database/instance";

export interface PostgradeConfigs {
    database?:Database[]
    users?:PgUser[],
    hba?:HBA[],
}