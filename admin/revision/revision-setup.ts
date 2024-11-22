import {revisionStructure} from "./revision-structure";
import {RevisionCore} from "./index";


export class RevisionSetup<P> {
    private core: RevisionCore<P>;

    constructor( core:RevisionCore<P> ) {
        this.core = core;
    }

    public prepareDatabase( resolve:( error:Error ) => void ){
        let self = this;

        this.core.connectionOf().execute( revisionStructure({
            schema: this.core.schema
        }), {
            onResult<R, N>(error: Error ) {
                if( error ) {
                    return resolve( error );
                }
                self.prepareDatabase = ()=>{
                    return resolve( null );
                }
                return resolve ( null )
            }
        })
    }

}