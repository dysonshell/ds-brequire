'use strict';
var path = require('path');
var vm = require('vm');
var tape = require('tape');
var browserify = require('browserify');
require('../../');

tape(function(test) {
    test.plan(5);
    browserify('./hello.js', {
        basedir: path.resolve(__dirname, '..'),
        fullPaths: true
    }).bundle(function(err, source) {
        console.log(arguments);
        console.log(source.toString('utf-8'));
        test.ok(!err);
        var sandbox = {};
        sandbox.global = sandbox.GLOBAL = sandbox;
        vm.runInNewContext(source.toString('utf-8'), sandbox);
        console.log('sandbox', sandbox);
        test.equal(sandbox.a, 'ma');
        test.equal(sandbox.b, 'b');
        test.equal(sandbox.c, 'mc');
        test.equal(sandbox.d, 'md');
        console.log(err);
    });
});
