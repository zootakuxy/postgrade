import { MongoClient } from "mongodb";
import {context} from "../../../context/index";

namespace mg {
    // mongodb://${MONGO_USER:-root}:${MONGO_PASSWORD}@mongo:27017
    const uri = `mongodb://${context.env.MONGO_HOST}:${ context.env.MONGO_PORT }`;  // URL de conexão, ajustada conforme sua configuração
    export const client = new MongoClient(uri, {
        auth: {
            username: context.env.MONGO_USER,
            password: context.env.MONGO_PASSWORD
        }
    });
}
export = mg;