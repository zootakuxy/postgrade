import {DBFlowResponse, PostgresContext, PostgresContextSteep} from "../index";
import fs from "fs";
import {Flow, FlowResponse, OutFlow, SteepFlow} from "kitres";

class RootFlow extends Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>{

    readonly identifier: PostgresContextSteep.FLOW_START;
    readonly steeps = PostgresContextSteep.FLOW_START;

    when(context:PostgresContext, steep:PostgresContextSteep): boolean {
        return true;
    }

    flow( context: PostgresContext, steep: PostgresContextSteep, preview: SteepFlow<PostgresContext, any, PostgresContextSteep>, flow: Flow<PostgresContext, DBFlowResponse, PostgresContextSteep>): FlowResponse<PostgresContext, DBFlowResponse, PostgresContextSteep> {
        context.check = {} as any;
        if( !context.options.minVersion && !!context.options.target ) context.options.minVersion = context.options.target;

        if( context.options.target && context.options.target < context.options.minVersion ){
            return {
                flow: OutFlow.BREAK,
                response: {
                    message: "Configuração invalida target da base de dados não pode ser menor que minversion"
                }
            }
        }

        if( !context.options.configs ){
            return {
                flow: OutFlow.BREAK,
                response: {
                    message: "Configuração de contexto não expecificada!"
                }
            };
        }

        if(! context.options.configs.database || !Array.isArray(context.options.configs.database) ){
            return {
                flow: OutFlow.BREAK,
                response: {
                    message: "Lista de base de dados invalida ou não definida!"
                }
            };
        }

        if(! context.options.configs.users || !Array.isArray( context.options.configs.users ) ){
            return {
                flow: OutFlow.BREAK,
                response: {
                    message: "Lista de utilizador de invalida ou não definida!"
                }
            };
        }

        let bads:({message:string, type:"user"|"database"|"base"|"setup"|"unknown"})[] = [];
        let push = ( message:string, type?:"user"|"database"|"base"|"setup" ) =>{
            bads.push({
                message: message,
                type: type || "unknown"
            })
        }

        context.options.configs.database.forEach( (dbname, index ) => {
            if( !dbname.setups ) dbname.setups = [];
            if( !dbname.search ) dbname.search = [];
            if( !dbname.grants ) dbname.grants = [];
            if( !dbname.newExtensions ) dbname.newExtensions = [];
            if( !dbname.schemas ) dbname.schemas = [];

            if( !dbname.dbname || !dbname.dbname.trim().length) push( `Não de banco de dados posição ${ index } não definido!` );
            if( !dbname.owner || !dbname.owner.trim().length ) push( `O owner para o banco de dados ${ dbname.dbname } posição ${ index } não expecificado!!` );
        });

        context.options.configs.users.filter( (user, index) =>  {
            if( !user.schemas ) user.schemas = [];
            if( !user.search ) user.search = [];
            if( !user.tests ) user.tests = [];
            user.superuser = user.superuser || false;
            user.replication = user.replication || false;

            if( !user.username || !user.username.trim().length) push( `Não de utilizador na posição ${ index } não definido!` );
            if( !user.password || !user.password.trim().length ) push( `A password para o utilizador ${ user.username } posição ${ index } não expecificado!!` );
        })

        context.options.configs.database.forEach( dbname => {
            if( !dbname.base ) return  push( `Database base file for ${ dbname.dbname } not definied!` );
            if( !fs.existsSync( dbname.base ) ) push( `Database ${ dbname.dbname } base file ${ new URL( `file://${ dbname.base }`)} does not exits!`)
        });

        context.options.configs.database.forEach( dbname => {
           if( !dbname.setups ) return;
           dbname.setups.forEach( setup => {
               if( !fs.existsSync( setup.filename ) ) push( `Database ${ dbname.dbname } setup file ${ new URL( `file://${ setup.filename }`)} does not exits!`)
           });
        });

        context.options.configs.users.filter( (user, indexUser) => {
            user.tests.forEach( (test, index) => {
                if( !test.database || !test.database.trim().length ) push( `Banco de dados para teste de usuario ${ user.username } na posicao ${indexUser}/${ index } não definido!`);
            });
        });

        if( bads.length ){
            return  {
                flow:  OutFlow.BREAK,
                response: {
                    message: bads.map( bad => bad.message ).join("\n"),
                    bads: bads
                }
            }
        }

        return {
            flow: OutFlow.CONTINUE,
            response: {
                message: "Database setup flow started!"
            }
        };
    }

}

export const steep100100StartFlow = new RootFlow();