import {VERSION} from "../../../context/version";
import {api} from "../server";


api.get([ "/VERSION", "/VER", "/ver", "/version" ], (req, res, next) => {
    res.send( VERSION.NUMBER );
});

api.get( ["/TAG", "/tag"], (req, res, next) => {
    res.send( VERSION.TAG );
});

api.get( ["/VERSION-NAME", "/VER-NAME", "/version-name", "/ver-name"], (req, res, next) => {
    res.send( VERSION.VERSION_CODE );
});

api.get( [ "/REVISION", "/REV", "/REVS", "/revision", "/rev", "/revs" ], (req, res, next) => {
    res.send( VERSION.REVISION );
});