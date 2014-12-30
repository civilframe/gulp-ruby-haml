var spawn = require('win-spawn');
var gutil = require('gulp-util');
var Buffer = require('buffer').Buffer;
var PluginError = gutil.PluginError;
var clone = require('clone');
var map = require('map-stream');

const PLUGIN_NAME = 'gulp-rkkn-ruby-haml';

module.exports = function (opt) {
  function modifyFile(file, callback) {
    if (file.isNull()) {
      return callback(null, file);
    }

    if (file.isStream()) {
      this.emit('error',
                new PluginError(PLUGIN_NAME, 'Streaming not supported'));
      return callback(null, file);
    }

    opt = opt || {};
    var options = {};
    options.outExtension = opt.outExtension || '.html';
    options.doubleQuote = opt.doubleQuote || false;
    options.style = opt.style || null;
    options.noEscapeAttr = opt.noEscapeAttr || false;
    options.requireFile = opt.requireFile || null;

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

    var self = this;
    cp.on('error', function (err) {
      self.emit('error', new PluginError(PLUGIN_NAME, err));
      return callback(null, file);
    });

    var haml_data = '';
    cp.stdout.on('data', function (data) { haml_data += data.toString(); });

    var errors = '';
    cp.stderr.setEncoding('utf8');
    cp.stderr.on('data', function (data) { errors += data.toString(); });

    cp.on('close', function (code) {
      if (errors) {
        self.emit('error', new PluginError(PLUGIN_NAME, errors));
        return callback(null, null);
      }

      if (code > 0) {
        self.emit('error', new PluginError(PLUGIN_NAME,
                                           'Exited with error code ' + code));
        return callback(null, null);
      }

      var newFile = clone(file);
      newFile.path = gutil.replaceExtension(file.path, options.outExtension);
      newFile.contents = new Buffer(haml_data);
      return callback(null, newFile);
    });
  }

  return map(modifyFile);
};
