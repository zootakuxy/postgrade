import e from "express";
import http from "node:http";
import {context} from "../../context/index";

const app = e();
const server = http.createServer( app );



export {
    server,
    app
}
server.listen( context.env.SERVER_PORT );