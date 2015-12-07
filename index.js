'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var config = require('config');
assert(config.dsAppRoot);
var Browserify = require('browserify');
var co = require('co');
var xtend = require('xtend');

// config
var APP_ROOT = config.dsAppRoot;
var DSC = config.dsComponentPrefix || 'dsc';
DSC = DSC.replace(/^\/+/, '').replace(/\/+$/, '') + '/';

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
        if (parent.filename.indexOf('/'+DSC) === -1 &&
            parent.filename.indexOf('/node_modules/@'+DSC) === -1 &&
            id.indexOf(DSC) !== 0 ) {
            return oresolve(id, parent, cb);
        }
        var results = [];
        if (parent.filename.indexOf('/node_modules/@'+DSC) > -1) {
            // 从 @dsc 里面 require 的，先尝试在 /dsc/ 里面找对应的
            results.push(yield coresolve(id, xtend(parent, {
                basedir: path.dirname(parent.filename.replace('/node_modules/@'+DSC, '/'+DSC))
            }, (typeof APP_ROOT === 'string' && id.indexOf(DSC) === 0) ? {
                paths: [APP_ROOT].concat(parent.paths),
            } : {})));
            if (results.slice(-1)[0].err) {
                results.push(yield coresolve(id.replace(new RegExp('^'+DSC), '@'+DSC), parent));
            }
        } else {
            // 从 `/dsc/` 里面 require 或者普通路径 require dsc/ 下面的，先直接找，再以 @dsc 下面为 fallback
            results.push(yield coresolve(id, parent));
            var repParFile = parent.filename.replace('/'+DSC, '/node_modules/@'+DSC);
            if (results.slice(-1)[0].err) {
                if (typeof APP_ROOT === 'string' && id.indexOf(DSC) === 0) {
                    results.push(yield coresolve(id, xtend(parent, {
                        paths: [APP_ROOT].concat(parent.paths),
                        basedir: APP_ROOT
                    })));
                }
                if (results.slice(-1)[0].err) {
                    results.push(yield coresolve(id.replace(new RegExp('^'+DSC), '@'+DSC), xtend(parent, {
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
