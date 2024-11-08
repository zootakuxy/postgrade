import Path from "path";
import fs from "fs";
import os from "os";
import {Defaults} from "./defaults";

import path from "path";
import {manifest} from "./manifest";

export function folder( ...parts:string[]){
    let _folder = Path.join( ...parts );
    if( !fs.existsSync( _folder ) ) {
        fs.mkdirSync( _folder, { recursive: true });
    }
    return _folder;
}

export const Folders = {
    get root(){
        let _root = Defaults.APP_ROOT;
        if( os.platform() === "win32" && !!process.env[ "ProgramData"] ) {
            _root = process.env[ "ProgramData" ];

        } else  if( os.platform() === "win32" && !!process.env[ "LOCALAPPDATA" ] ){
            _root = process.env[ "LOCALAPPDATA" ];

        } else if( os.platform() === "win32" && !!process.env[ "APPDATA"] ){
            _root = process.env[ "APPDATA"];

        } else if( os.platform() === "win32" && !!process.env[ "USERPROFILE"] ){
            _root = process.env[ "USERPROFILE"];

        } else if( !!os.homedir() ) {
            _root = os.homedir();

        } else if ( !!process.env[ "HOME"]) {
            _root =process.env["HOME"];
        }

        return folder( _root, "BrainsoftSTP.com" )
    },

    get volatile(){
        let volatile = this.root;
        if( os.platform() === "win32" && process.env[ "TEMP" ] )
            volatile =  process.env[ "TEMP" ];
        return folder( this.root, "temp.brainsoftstp.com" );
    },

    //Application
    get views(){ return folder( __dirname, /*language=file-reference*/ "../../../client/views")},
    get public(){ return folder( __dirname, /*language=file-reference*/ "../../../client/public")},
    get contents(){ return folder( __dirname, /*language=file-reference*/ "../../../client/contents")},
    get bin(){ return folder( __dirname, /*language=file-reference*/ "../../../bin")},


    //Application
    get home(){ return folder( this.root, "apps", manifest.name ); },
    get storage(){ return folder( this.home, "storage" ) },
    get cloudStorage() {  return folder( this.home, "storage/cloud" ); },
    get shareStorage() {  return folder( this.home, "storage/share" ); },
    get filesStorage() {  return folder( this.home, "storage/files" ); },
    get privateStorage() { return folder( this.home, '/storage/private'  ); },
    get mnt() { return folder( this.home, '/storage/mnt' ); },

    get backup(){ return folder( this.home, "backups" ) },
    get dumps(){ return folder( this.home, "dumps" ) },
    get base_dump(){ return Path.join( this.dumps, `${manifest.name}.base.db`)},

    get temp () { return folder( path.join( this.volatile, manifest.name ) ); },

    get sessions () { return folder( path.join( this.home, '/sessions' ) ); },

    get snapshot () { return folder( __dirname, '../..' ); },
}