import {EnvAS, EnvParser} from "../libs/utils/env";

export type EnvMode = "dev" | "test" | "prop" | "public";

export class EnvOptions {
    NAME: string =  "POSTGRADE:ADMIN"
    MODE: EnvMode = "dev"
    CONFIGS: string = "/etc/postgrade/main.conf"
    SETUP: string = "/postgrade/setups"

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

export const definition:{[ K in keyof EnvOptions ]?:EnvParser } = {
    MAIL_PORT: value => EnvAS.integer( value ),
    SERVER_PORT: value  => EnvAS.integer( value ),
    POSTGRES_VERSION: value  => EnvAS.integer( value ),
    POSTGRES_PORT: value  => EnvAS.integer( value ),
    // MAIL_PASSWORD: (value, origin, configFile) => _as.password( value, origin, configFile),
    // POSTGRES_PASSWORD:(value, origin, configFile) => _as.password( value, origin, configFile),
}












