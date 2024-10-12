import { PgCore } from "kitres";
import {Pool} from "pg";
import {context} from "../../context/index";

namespace dao {
    let pool = new Pool({
        host: context.env.POSTGRES_HOST,
        database: context.env.POSTGRES_NAME,
        password: context.env.POSTGRES_PASSWORD,
        port: context.env.POSTGRES_PORT,
        user: context.env.POSTGRES_SUPERUSER,
        application_name: context.env.NAME
    });
    export const core = new PgCore( () => pool,  {
        schema: "public"
    });
}

export  = dao;