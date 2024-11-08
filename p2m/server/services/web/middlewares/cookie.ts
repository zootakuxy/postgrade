
import cookieParser from "cookie-parser";
import {api} from "../server";

api.use( cookieParser() );