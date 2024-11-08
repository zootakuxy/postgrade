
import bodyParser from "body-parser";
import {api} from "../server";
api.use( bodyParser.json( { limit: '1000mb' } ) );
api.use( bodyParser.urlencoded({ extended: true, limit: '1000mb' }));
api.use( bodyParser.raw({ limit: '1000mb' } ) );
api.use( bodyParser.text( { limit: '1000mb' } ) );