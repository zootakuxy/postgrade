

////////////////// MIDDLEWARES ////////////////////

//Welcome
require( './middlewares/welcome' );


// Cookie Parser
require( './middlewares/cookie' );

//Head
require( './middlewares/head' );

//Body Parser
require( './middlewares/body-parser' );

//Cors
require( './middlewares/cors' );

//
// //DatabaseConnection
// require( './middlewares/connection' );
//
// //Sets transaction
// require( './middlewares/transaction' );
//
// //Licence Guard
// require( './middlewares/license' );
//
//
//
// //Resources
// require( "./middlewares/ejs.page.js" );
// require( "./middlewares/static.page.js" );
// require( "./middlewares/static.file" );
//
// //Capturar as transção de tudo que não é pagena ou static
// require( './middlewares/transaction-capture' );
//
// //Remote
// require( "./middlewares/remote" );
//
// //Flocoto
// // require( "./middlewares/flocoto-integration" );
//
// require( "./middlewares/x-direct" );
// require( "./middlewares/flocoto" );
// require( "./middlewares/flocoto-viewport" );

export { app, server } from './server';
