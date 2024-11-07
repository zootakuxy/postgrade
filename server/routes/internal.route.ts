import {app} from "../services/web";
import mg from "../services/database/mg";
import { InsertManyResult, InsertOneResult } from "mongodb";
import {context} from "../context/index";

async function inserts( db:string, collection:string,  items:any, opts:any){
    if( !Array.isArray( items ) && items !== null && items !== undefined ) items = [ items ];
    if( !items || !items.length ) return {
        return: false,
        message: `No Itens Inserts`
    }

    let returning = !!opts?.returning;
    let returns:any;
    await mg.client.connect();
    const database = mg.client.db( db );
    const col = database.collection( collection );

    let response:{
        method?:"insertMany"|"insertOne",
        result?:boolean,
        inserts?: InsertManyResult<any>|InsertOneResult<Document>,
        returns?:any,
        ids:any
    };

    if( items.length > 1) {
        // Inserção de múltiplos documentos
        const inserts = await col.insertMany( items, opts );
        if( returning ){
            returns = await col.find({ _id: { $in: Object.values( inserts.insertedIds) } }).toArray()
        }
        response = {
            result: true,
            method: "insertMany",
            inserts: inserts,
            ids: inserts.insertedIds,
            returns
        }
    } else {
        const inserts = await col.insertOne( items[0], opts );
        if( returning ){
            returns = await col.findOne({ _id: inserts.insertedId })
        }
        response = {
            result: true,
            method: "insertOne",
            inserts,
            returns: [ returns ],
            ids:[ inserts.insertedId ]
        }
    }

    return response;
}
async function updates( db:string, collection:string, method:string,  filter:any, sets:any, opts?:any){

    await mg.client.connect();
    const database = mg.client.db( db );
    const col = database.collection( collection );

    if( ["one", "updateOne", "update_one" ].includes( method||"one" )) {
        // Inserção de múltiplos documentos
        const updates = await col.updateOne(
            filter,
            sets,
            opts
        );
        return {
            return: true,
            method: "updateOne",
            updates,
            ids: [ updates.upsertedId ]
        }
    } else {
        const updates = await col.updateMany(
            filter,
            sets,
            opts
        );

        return {
            result: true,
            method: "updateMany",
            updates,
            ids:updates.upsertedId
        }
    }
}
app.post( "/insert/:db/:collection", (req, res, next) => {
    let items = req.body.items;
    let opts = req.body.opts;
    inserts( req.params.db, req.params.collection, items, opts ).then( value => {
        res.json(value)
    }).catch( reason => {
        console.error( context.tag, `Error ao inserir documento no mongoDB` );
        res.status( 500 ).json({
            message:`Internal server error!`,
            hint: reason?.message
        })
    });
});
app.post( "/update/:db/:collection", (req, res, next) => { });
app.post( "/find/:db/:collection", (req, res, next) => { });