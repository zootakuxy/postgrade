import e from "express";
import http from "node:http";
import {context} from "../../context/index";

const api = e();
const app = e();
const server = http.createServer( api );
const internal = http.createServer( app );



export {
    server,
    api,
    app
}
server.listen( context.env.SERVER_PORT );
internal.listen( context.env.SERVER_INTERNAL );