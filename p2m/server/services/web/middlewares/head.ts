import {app} from "../server";
import {VERSION} from "../../../../../version";


app.get([ "/VERSION", "/VER", "/ver", "/version" ], (req, res, next) => {
    res.send( VERSION.NUMBER );
});

app.get( ["/TAG", "/tag"], (req, res, next) => {
    res.send( VERSION.TAG );
});

app.get( ["/VERSION-NAME", "/VER-NAME", "/version-name", "/ver-name"], (req, res, next) => {
    res.send( VERSION.VERSION_CODE );
});

app.get( [ "/REVISION", "/REV", "/REVS", "/revision", "/rev", "/revs" ], (req, res, next) => {
    res.send( VERSION.REVISION );
});