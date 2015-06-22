var spawn = require('win-spawn');
var gutil = require('gulp-util');
var Buffer = require('buffer').Buffer;
var PluginError = gutil.PluginError;
var clone = require('clone');
var through = require('through2');
var q = require('q');

const PLUGIN_NAME = 'gulp-ruby-haml-rkkn';
const MAX_RUBY_WORKERS = 5;

module.exports = function (opt) {

  var files = [];

  function bufferFile(file, enc, callback) {
    if (file.isNull()) {
      callback();
      return;
    }

    if (file.isStream()) {
      this.emit('error', new PluginError(PLUGIN_NAME,  'Streaming not supported'));
      callback();
      return;
    }

    files.push(file);
    callback();
  };

  function compileFiles(callback) {
    _this = this;
    
    opt = opt || {};
    var options = {};
    options.outExtension = opt.outExtension || '.html';
    options.doubleQuote = opt.doubleQuote || false;
    options.style = opt.style || null;
    options.noEscapeAttr = opt.noEscapeAttr || false;
    options.requireFile = opt.requireFile || null;
    options.maxRubyWorkers = opt.maxRubyWorkers || MAX_RUBY_WORKERS;

    var batches = [];
    batchCount = 0;
    batchSize = Math.ceil(files.length / MAX_RUBY_WORKERS)
    files.forEach(function(file) {
      if (batchCount <= 0) {
        batches.push([]);
        batchCount = batchSize;
      }

      batches[batches.length-1].push(file);
      batchCount--;
    });

    promises = []
    batches.forEach(function(batch) {
      batch.forEach(function(file) {

        promise = q.Promise(function(resolve, reject) {
          var args = ['haml'];
          if (options.doubleQuote) {
            args.push('-q');
          }
          if (options.style !== null) {
            args.push('--style', options.style);
          }
          if (options.noEscapeAttr === true) {
            args.push('--no-escape-attrs');
          }
          if (options.requireFile !== null) {
            args.push('--require', options.requireFile);
          }
          args.push(file.path);

          var cp = spawn(args.shift(), args);

          var haml_data = '';
          cp.stdout.on('data', function (data) { haml_data += data.toString(); });

          var errors = '';
          cp.stderr.setEncoding('utf8');
          cp.stderr.on('data', function (data) { errors += data.toString(); });

          var errorPrepend = file.path + '\n\n';

          cp.on('error', function (err) {
            reject(errorPrepend + err);
            return;
          });

          cp.on('close', function (code) {
            if (errors.length > 0) {
              reject(errorPrepend + errors);
              return;
            }

            if (code > 0) {
              reject('Exited with error code ' + code);
              return;
            }

            var newFile = clone(file);
            newFile.path = gutil.replaceExtension(file.path, options.outExtension);
            newFile.contents = new Buffer(haml_data);
          
            _this.push(newFile);

            resolve();
          });
        });

        promises.push(promise);
      });
    });

    q.all(promises)
      .fail(function(error) {
        _this.emit('error', new PluginError(PLUGIN_NAME,  error));
      })
      .finally(function() {
        callback();
      });
  };

  return through.obj(bufferFile, compileFiles);
};