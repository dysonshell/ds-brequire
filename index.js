'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var config = require('config');
assert(config.dsAppRoot);
var Browserify = require('browserify');
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

    function exists(filePath) {
        return new Promise(function(resolve) {
            fs.exists(filePath, resolve);
        });
    }
    options.resolve = function (id, parent, ocb) {
        var originalParentFilename;
        var cb = function (err, file, pkg) {
            if (err && typeof err.message === 'string') {
                err.message += " (file '" + parent.filename + "')";
            }
            ocb(err, file, pkg);
        }
        if (parent.filename.indexOf('/'+DSC) === -1 &&
            parent.filename.indexOf('/node_modules/@'+DSC) === -1 &&
            id.indexOf(DSC) !== 0 ) {
            return oresolve(id, parent, cb);
        }
        var results = [];
        id = id.replace(new RegExp('^'+DSC), DSC);
        if (parent.filename.indexOf('/node_modules/@'+DSC) > -1) {
            // 从 @dsc 里面 require 的，先尝试在 /dsc/ 里面找对应的
            oresolve(id, xtend(parent, {
                basedir: path.dirname(parent.filename.replace('/node_modules/@'+DSC, '/'+DSC))
            }, (id.indexOf(DSC) === 0) ? {
                paths: [APP_ROOT].concat(parent.paths),
            } : {}), function (err, file, pkg) {
                if (err) {
                    oresolve(id.replace(new RegExp('^'+DSC), '@'+DSC), parent, cb);
                } else {
                    cb(err, file, pkg);
                }
            });
        } else {
            // 从 `/dsc/` 里面 require 或者普通路径 require dsc/ 下面的，先直接找，再以 @dsc 下面为 fallback
            var xparent = xtend(parent, {
                paths: [APP_ROOT].concat(parent.paths),
                basedir: APP_ROOT
            });
            oresolve(id, xparent, function (err, file, pkg) {
                var repParFile = parent.filename.replace('/'+DSC, '/node_modules/@'+DSC);
                if (err) {
                    oresolve(id.replace(new RegExp('^'+DSC), '@'+DSC), xtend(parent, {
                        filename: repParFile,
                        basedir: path.dirname(repParFile)
                    }), cb);
                } else {
                    cb(err, file, pkg);
                }
            });
        }
    };
    return mdeps(options);
}
