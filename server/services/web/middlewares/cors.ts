
import cors from "cors";
import {api} from "../server";

api.use( cors({
    origin: (requestOrigin, callback) => {
        callback(null, requestOrigin );
    }
}) );