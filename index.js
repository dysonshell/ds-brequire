'use strict';
require('@ds/common');
var fs = require('fs');
var path = require('path');
var Browserify = require('browserify');
var co = require('co');
var xtend = require('xtend');

var _createDeps = Browserify.prototype._createDeps;
Browserify.prototype._createDeps = function(opts) {
    var _mdeps = _createDeps.call(this, opts);
    var mdeps = _mdeps.constructor;
    var options = _mdeps.options;
    var oresolve = options.resolve;

    function coresolve(id, parent) {
        return new Promise(function(r) {
            oresolve(id, parent, function(err, file, pkg) {
                r({
                    err: err,
                    file: file,
                    pkg: pkg,
                });
            });
        });
    }

    function exists(filePath) {
        return new Promise(function(resolve) {
            fs.exists(filePath, resolve);
        });
    }
    options.resolve = co.wrap(function * (id, parent, cb) {
        var originalParentFilename;
        if (parent.filename.indexOf('/ccc/') === -1 &&
            parent.filename.indexOf('/node_modules/@ccc/') === -1 &&
            id.indexOf('ccc/') !== 0 ) {
            return oresolve(id, parent, cb);
        }
        var results = [];
        if (parent.filename.indexOf('/node_modules/@ccc/') > -1) {
            // 从 @ccc 里面 require 的，先尝试在 /ccc/ 里面找对应的
            results.push(yield coresolve(id, xtend(parent, {
                basedir: path.dirname(parent.filename.replace('/node_modules/@ccc/', '/ccc/'))
            })));
            if (results.slice(-1)[0].err) {
                results.push(yield coresolve(id.replace(/^ccc\//, '@ccc/'), parent));
            }
        } else {
            // 从 `/ccc/` 里面 require 或者普通路径 require ccc/ 下面的，先直接找，再以 @ccc 下面为 fallback
            results.push(yield coresolve(id, parent));
            var repParFile = parent.filename.replace('/ccc/', '/node_modules/@ccc/');
            if (results.slice(-1)[0].err) {
                if (typeof GLOBAL.APP_ROOT === 'string' && id.indexOf('ccc/') === 0) {
                    results.push(yield coresolve(id, xtend(parent, {
                        paths: [APP_ROOT].concat(parent.paths),
                        basedir: APP_ROOT
                    })));
                }
                if (results.slice(-1)[0].err) {
                    results.push(yield coresolve(id.replace(/^ccc\//, '@ccc/'), xtend(parent, {
                        filename: repParFile,
                        basedir: path.dirname(repParFile)
                    })));
                }
            }
        }
        var result = results.filter(function(r) {
            return !r.err;
        })[0];
        if (!result) {
            return cb(results[0].err);
        }
        cb(null, result.file, result.pkg);
    });
    return mdeps(options);
}
