
import bodyParser from "body-parser";
import {app} from "../server";
app.use( bodyParser.json( { limit: '1000mb' } ) );
app.use( bodyParser.urlencoded({ extended: true, limit: '1000mb' }));
app.use( bodyParser.raw({ limit: '1000mb' } ) );
app.use( bodyParser.text( { limit: '1000mb' } ) );