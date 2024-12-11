import {EnvAS, EnvParser} from "../libs/utils/env";

export type EnvMode = "dev" | "test" | "prop" | "public";
export class EnvOptions {
    SERVICE:string = "srv-postgrade"
    DOMAIN:string = "postgrade.domain"
    NAME: string =  "POSTGRADE:ADMIN"
    MODE: EnvMode = "dev"
    CONFIGS: string = "/etc/postgrade/main.conf"
    SETUP: string = "/etc/postgrade"

    POSTGRES_NAME: string = "postgres"
    POSTGRES_SUPERUSER: string = "postgres"
    POSTGRES_PASSWORD: string = null
    POSTGRES_HOST: string = "pg.db.srv"
    POSTGRES_CLUSTER: string = "/var/lib/postgresql/data"
    POSTGRES_VERSION:  number = 14
    POSTGRES_PORT: number = 5432



    SERVER_PORT=4000
    SERVER_PROTOCOL: "http"|"https" = "http"

    MAIL_PASSWORD: string
    MAIL_HOSTNAME: string = null
    MAIL_NAME: string = null
    MAIL_MAIL: string = null
    MAIL_PORT: number = null
}

export const definition:{[ K in keyof EnvOptions ]?:EnvParser } = {
    MAIL_PORT: value => EnvAS.integer( value ),
    SERVER_PORT: value  => EnvAS.integer( value ),
    POSTGRES_VERSION: value  => EnvAS.integer( value ),
    POSTGRES_PORT: value  => EnvAS.integer( value ),
    MAIL_PASSWORD: (value, origin, configFile) => EnvAS.password( value, origin, configFile),
    POSTGRES_PASSWORD:(value, origin, configFile) => EnvAS.password( value, origin, configFile),
}












