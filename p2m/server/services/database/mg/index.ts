import { MongoClient } from "mongodb";

namespace mg {
    const uri = 'mongodb://127.0.0.1:27017';  // URL de conexão, ajustada conforme sua configuração
    export const client = new MongoClient(uri);
}
export = mg;