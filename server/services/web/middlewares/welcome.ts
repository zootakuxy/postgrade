import cluster from "cluster";
import {context} from "../../../context";
import {app} from "../server";

app.use( (req, res, next) => {
    if( cluster.isWorker ) console.log(context.tag, `new request from ${req.headers.host} ON worker-id: ${cluster.worker.id} | ${req.method}${req.path}`);
    else console.log( context.tag, `new request from ${req.headers.host} | ${req.method}${req.path}`);
    next();
});

