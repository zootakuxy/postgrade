import {app} from "../services/web";
import mg from "../services/database/mg/index";
import {Collection } from "mongodb";
import {context} from "../context/index";

let returnsOf = async ( col:Collection, refs:any[] ) =>{
    return await col.find({_id: {$in: refs}}).toArray();
}

async function inserts( db:string, collection:string,  items:any, opts:any){
    if( !Array.isArray( items ) && items !== null && items !== undefined ) items = [ items ];
    if( !items || !items.length ) return {
        return: false,
        message: `No Itens Inserts`
    }

    if( !opts ) opts = {};

    let returning = !!opts?.returning;
    let returns:any;
    await mg.client.connect();
    const database = mg.client.db( db );
    const col = database.collection( collection );

    let response:{
        method?:"insertMany"|"insertOne",
        result?:boolean,
        returns?:any[],
    };

    if( items.length > 1) {
        // Inserção de múltiplos documentos
        const inserts = await col.insertMany( items, opts );
        if( returning ){
            returns = await returnsOf( col, Object.values( inserts.insertedIds) );
        }
        response = {
            result: true,
            method: "insertMany",
            returns
        }
    } else {
        const inserts = await col.insertOne( items[0], opts );
        if( returning ){
            returns = await returnsOf( col, [ inserts.insertedId ])
        }
        response = {
            result: true,
            method: "insertOne",
            returns: returns,
        }
    }

    return response;
}

async function finds( db:string, collection:string,  filter:any, opts:any){
    await mg.client.connect();
    const database = mg.client.db( db );
    const col = database.collection( collection );

    if( !filter ) filter = {};
    if( !opts ) opts = {};

    let response:{
        method?:"insertMany"|"insertOne",
        result?:boolean,
        returns?:any[],
    };
    let returns =  await col.find( filter ||{}, opts||{} ).toArray();
    response = {
        result: true,
        method: "insertOne",
        returns: returns,
    }
    return response;
}

async function updates( db:string, collection:string,  filter:any, sets:any, opts:any ){
    let returning = !!opts?.returning;
    await mg.client.connect();
    const database = mg.client.db( db );
    const col = database.collection( collection );

    if( !filter ) filter = {};
    if( !sets ) sets = {};
    if( !opts ) opts = {};

    let response:{
        method?:"insertMany"|"insertOne",
        result?:boolean,
        returns?:any[],
    };

    let returns = null;
    if( returning ){
        let ids = (await col.find( filter, opts ).toArray()).map( value => value._id );
        let updates =  await col.updateMany(
            { _id:{ $in: ids }},
            sets,
            opts
        )
        returns = await col.find( { _id:{ $in: ids }}, opts ).toArray()
    } else {
        await col.updateMany(
            filter,
            sets,
            opts
        )
    }
    response = {
        result: true,
        method: "insertOne",
        returns: returns,
    }
    return response;
}

async function deletes( db:string, collection:string,  filter:any, opts:any ){

    let returning = !!opts?.returning;
    await mg.client.connect();
    const database = mg.client.db( db );
    const col = database.collection( collection );

    if( !filter ) filter = {};
    if( !opts ) opts = {};

    let response:{
        method?:"insertMany"|"insertOne",
        result?:boolean,
        returns?:any[],
    };

    let returns = null;
    if( returning ){
        returns = await col.find( filter, opts ).toArray();
        await col.deleteMany({
            _id: { $in: returns.map( n => n._id )}
        })
    } else {
        await col.deleteMany( filter, opts )
    }

    response = {
        result: true,
        method: "insertOne",
        returns: returns,
    }
    return response;
}

app.post( "/:db/:collection/finds", (req, res, next) => {
    let filter = req.body.filter;
    let opts = req.body.opts;
    finds( req.params.db, req.params.collection, filter, opts ).then( value => {
        res.json(value)
    }).catch( reason => {
        console.error( context.tag, `Error ao bunscar pelos documentos`, reason );
        res.status( 500 ).json({
            message:`Internal server error!`,
            hint: reason?.message
        })
    });
});

app.post( "/:db/:collection/inserts", (req, res, next) => {
    let items = req.body.items;
    let opts = req.body.opts;
    inserts( req.params.db, req.params.collection, items, opts ).then( value => {
        res.json(value)
    }).catch( reason => {
        console.error( context.tag, `Error ao inserir os documento no mongoDB`, reason );
        res.status( 500 ).json({
            message:`Internal server error!`,
            hint: reason?.message
        })
    });
});

app.post( "/:db/:collection/updates", (req, res, next) => {
    let filter = req.body.filter;
    let sets = req.body.sets;
    let opts = req.body.opts;
    updates( req.params.db, req.params.collection, filter, sets, opts ).then( value => {
        res.json(value)
    }).catch( reason => {
        console.error( context.tag, `Error ao autualizar documento no mongoDB`, reason );
        res.status( 500 ).json({
            message:`Internal server error!`,
            hint: reason?.message
        })
    });
});

app.post( "/:db/:collection/deletes", (req, res, next) => {
    let filter = req.body.filter;
    let opts = req.body.opts;
    deletes( req.params.db, req.params.collection, filter, opts ).then( value => {
        res.json(value)
    }).catch( reason => {
        console.error( context.tag, `Error ao remover documento no mongoDB`, reason );
        res.status( 500 ).json({
            message:`Internal server error!`,
            hint: reason?.message
        })
    });
});


console.log( "Loaded route file", __filename );