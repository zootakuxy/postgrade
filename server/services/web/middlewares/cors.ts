
import cors from "cors";
import {app} from "../server";

app.use( cors({
    origin: (requestOrigin, callback) => {
        callback(null, requestOrigin );
    }
}) );