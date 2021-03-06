/*

http://came.io/

A utility for starting and administering Cameio based mobile app projects.
Licensed under the MIT license. See LICENSE For more.

*/

var argv = require('optimist').argv,
    colors = require('colors'),
    Q = require('q'),
    settings = require('../package.json'),
    shelljs = require('shelljs/global');

colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  small: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'white',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red'
});


var TASKS = [
  {
    title: 'start',
    name: 'start',
    summary: 'Starts a new Cameio project in the specified PATH',
    args: {
      '[options]': 'any flags for the command',
      '<PATH>': 'directory for the new project',
      '[template]': 'Template name, ex: tabs, sidemenu, blank\n' +
                    'Codepen url, ex: http://codepen.io/cameio/pen/odqCz\n' +
                    'Defaults to Cameio "tabs" starter template'
    },
    options: {
      '--appname|-a': 'Human readable name for the app (Use quotes around the name)',
      '--id|-i': 'Package name for <widget id> config, ex: com.mycompany.myapp',
      '--no-cordova|-w': 'Create a basic structure without Cordova requirements',
      '--sass|-s': 'Setup the project to use Sass CSS precompiling'
    },
    module: './cameio/start'
  },
  {
    title: 'serve',
    name: 'serve',
    summary: 'Start a local development server for app dev/testing',
    args: {
      '[options]': ''
    },
    options: {
      '--consolelogs|-c': 'Print app console logs to Cameio CLI',
      '--serverlogs|-s': 'Print dev server logs to Cameio CLI',
      '--port|-p': 'Dev server HTTP port (8100 default)',
      '--livereload-port|-r': 'Live Reload port (35729 default)',
      '--nobrowser|-b': 'Disable launching a browser',
      '--nolivereload': 'Do not start live reload'
    },
    module: './cameio/serve'
  },
  {
    title: 'platform',
    name: 'platform',
    summary: 'Add platform target for building an Cameio app',
    args: {
      '[options]': '',
      '<PLATFORM>': ''
    },
    module: './cameio/cordova'
  },
  {
    title: 'run',
    name: 'run',
    summary: 'Run an Cameio project on a connected device',
    args: {
      '[options]': '',
      '<PLATFORM>': ''
    },
    options: {
      '--livereload|-l': 'Live reload app dev files from the device' + ' (beta)'.yellow,
      '--port|-p': 'Dev server HTTP port (8100 default, livereload req.)',
      '--livereload-port|-r': 'Live Reload port (35729 default, livereload req.)',
      '--consolelogs|-c': 'Print app console logs to Cameio CLI (livereload req.)',
      '--serverlogs|-s': 'Print dev server logs to Cameio CLI (livereload req.)',
      '--debug|--release': '',
      '--device|--emulator|--target=FOO': ''
    },
    module: './cameio/cordova'
  },
  {
    title: 'emulate',
    name: 'emulate',
    summary: 'Emulate an Cameio project on a simulator or emulator',
    args: {
      '[options]': '',
      '<PLATFORM>': ''
    },
    options: {
      '--livereload|-l': 'Live reload app dev files from the device' + ' (beta)'.yellow,
      '--port|-p': 'Dev server HTTP port (8100 default, livereload req.)',
      '--livereload-port|-r': 'Live Reload port (35729 default, livereload req.)',
      '--consolelogs|-c': 'Print app console logs to Cameio CLI (livereload req.)',
      '--serverlogs|-s': 'Print dev server logs to Cameio CLI (livereload req.)',
      '--debug|--release': '',
      '--device|--emulator|--target=FOO': ''
    },
    module: './cameio/cordova'
  },
  {
    title: 'build',
    name: 'build',
    summary: 'Locally build an Cameio project for a given platform',
    args: {
      '[options]': '',
      '<PLATFORM>': ''
    },
    module: './cameio/cordova'
  },
  {
    title: 'plugin add',
    name: 'plugin',
    summary: 'Add a Cordova plugin',
    args: {
      '[options]': '',
      '<SPEC>': 'Can be a plugin ID, a local path, or a git URL.'
    },
    options: {
      '--searchpath <directory>': 'When looking up plugins by ID, look in this directory\n' +
                                  'and subdirectories first for the plugin before\n' +
                                  'looking it up in the registry.'
    },
    module: './cameio/cordova'
  },
  {
    title: 'prepare',
    name: 'prepare',
    module: './cameio/cordova'
  },
  {
    title: 'compile',
    name: 'compile',
    module: './cameio/cordova'
  },
  {
    title: 'package',
    name: 'package',
    alt: ['pack'],
    summary: 'Package an app using the Cameio Build service' + ' (beta)'.yellow,
    args: {
      '[options]': '',
      '<MODE>': '"debug" or "release"',
      '<PLATFORM>': '"ios" or "android"'
    },
    options: {
      '--android-keystore-file|-k': 'Android keystore file',
      '--android-keystore-alias|-a': 'Android keystore alias',
      '--android-keystore-password|-w': 'Android keystore password',
      '--android-key-password|-r': 'Android key password',
      '--ios-certificate-file|-c': 'iOS certificate file',
      '--ios-certificate-password|-d': 'iOS certificate password',
      '--ios-profile-file|-f': 'iOS profile file',
      '--output|-o': 'Path to save the packaged app',
      '--no-email|-n': 'Do not send a build package email',
      '--clear-signing|-l': 'Clear out all signing data from Cameio server',
      '--email|-e': 'Cameio account email',
      '--password|-p': 'Cameio account password'
    },
    module: './cameio/package'
  },
  {
    title: 'upload',
    name: 'upload',
    summary: 'Upload an app to your Cameio account',
    options: {
      '--email|-e': 'Cameio account email',
      '--password|-p': 'Cameio account password'
    },
    alt: ['up'],
    module: './cameio/upload'
  },
  {
    title: 'lib',
    name: 'lib',
    summary: 'Gets Cameio library version or updates the Cameio library',
    args: {
      '[options]': '',
      '[update]': 'Updates the Cameio Framework in www/lib/cameio'
    },
    options: {
      '--version|-v': 'Spcific Cameio version\nOtherwise it defaults to the latest version'
    },
    module: './cameio/lib'
  },
  {
    title: 'setup',
    name: 'setup',
    summary: 'Configure the project with a build tool ' + '(beta)'.yellow,
    args: {
      '[sass]': 'Setup the project to use Sass CSS precompiling'
    },
    module: './cameio/setup'
  },
  {
    title: 'login',
    name: 'login',
    module: './cameio/login'
  },
  {
    title: 'address',
    name: 'address',
    module: './cameio/serve'
  },
  {
    title: 'app',
    name: 'app',
    // summary: 'Deploy a new Cameio app version or list versions',
    // options: {
    //   '--versions|-v': 'List recently uploaded versions of this app',
    //   '--deploy|-d': 'Upload the current working copy and mark it as deployed',
    //   '--note|-n': 'Add a note to a deploy',
    //   '--uuid|-u': 'Mark an already uploaded version as deployed'
    // },
    module: './cameio/app'
   }
];

Cameio = {
  CAMEIO_DASH: 'https://apps.cameio.io',
  //CAMEIO_DASH: 'http://localhost:8000',
  CAMEIO_API: '/api/v1/',
  PRIVATE_PATH: '.cameio',
  _tryBuildingTask: function() {
    if(argv._.length === 0) {
      return false;
    }
    var taskName = argv._[0];

    return this._getTaskWithName(taskName);
  },

  _getTaskWithName: function(name) {
    for(var i = 0; i < TASKS.length; i++) {
      var t = TASKS[i];
      if(t.name === name) {
        return t;
      }
      if(t.alt) {
        for(var j = 0; j < t.alt.length; j++) {
          var alt = t.alt[j];
          if(alt === name) {
            return t;
          }
        }
      }
    }
  },

  printUsage: function(d) {
    var w = function(s) {
      process.stdout.write(s);
    };

    w('\n');

    var rightColumn = 41;
    var dots = '';
    var indent = '';
    var x, arg;

    var taskArgs = d.title;

    for(arg in d.args) {
      taskArgs += ' ' + arg;
    }

    w(taskArgs.green.bold);

    while( (taskArgs + dots).length < rightColumn + 1) {
      dots += '.';
    }

    w(' ' + dots.grey + '  ');

    if(d.summary) {
      w(d.summary.bold);
    }

    for(arg in d.args) {
      if( !d.args[arg] ) continue;

      indent = '';
      w('\n');
      while(indent.length < rightColumn) {
        indent += ' ';
      }
      w( (indent + '    ' + arg + ' ').bold );

      var argDescs = d.args[arg].split('\n');
      var argIndent = indent + '    ';

      for(x=0; x<arg.length + 1; x++) {
        argIndent += ' ';
      }

      for(x=0; x<argDescs.length; x++) {
        if(x===0) {
          w( argDescs[x].bold );
        } else {
          w( '\n' + argIndent + argDescs[x].bold );
        }
      }
    }

    indent = '';
    while(indent.length < d.name.length + 1) {
      indent += ' ';
    }

    var optIndent = indent;
    while(optIndent.length < rightColumn + 4) {
      optIndent += ' ';
    }

    for(var opt in d.options) {
      w('\n');
      dots = '';

      var optLine = indent + '[' + opt + ']  ';

      w(optLine.yellow.bold);

      if(d.options[opt]) {
        while( (dots.length + optLine.length - 2) < rightColumn) {
          dots += '.';
        }
        w(dots.grey + '  ');

        var optDescs = d.options[opt].split('\n');
        for(x=0; x<optDescs.length; x++) {
          if(x===0) {
            w( optDescs[x].bold );
          } else {
            w( '\n' + optIndent + optDescs[x].bold );
          }
        }
      }
    }

    w('\n');
  },

  _printAvailableTasks: function() {
    this._printCameio();
    process.stderr.write('\nUsage: cameio task args\n\n=======================\n\n');

    if(process.argv.length > 2) {
      process.stderr.write( (process.argv[2] + ' is not a valid task\n\n').bold.red );
    }

    process.stderr.write('Available tasks: '.bold);
    process.stderr.write('(use --help or -h for more info)\n\n');

    for(var i = 0; i < TASKS.length; i++) {
      var task = TASKS[i];
      if(task.summary) {
        var name = '   ' + task.name + '  ';
        var dots = '';
        while((name + dots).length < 20) {
          dots += '.';
        }
        process.stderr.write(name.green.bold + dots.grey + '  ' + task.summary.bold + '\n');
      }
    }

    process.stderr.write('\n');
    this.processExit(1);
  },

  _printHelpLines: function() {
    this._printCameio();
    process.stderr.write('\n=======================\n');

    for(var i = 0; i < TASKS.length; i++) {
      var task = TASKS[i];
      if(task.summary) {
        this.printUsage(task);
      }
    }

    process.stderr.write('\n');
    this.processExit(1);
  },

  _printCameio: function() {
    var w = function(s) {
      process.stdout.write(s);
    };

    w('  _             _     \n');
    w(' (_)           (_)     \n');
    w('  _  ___  _ __  _  ___ \n');
    w(' | |/ _ \\| \'_ \\| |/ __|\n');
    w(' | | (_) | | | | | (__ \n');
    w(' |_|\\___/|_| |_|_|\\___|  CLI v'+ settings.version + '\n');

  },

  run: function() {
    var self = this;

    self.checkLatestVersion();

    process.on('exit', function(){
      self.printVersionWarning();
    });

    if( (argv.version || argv.v) && !argv._.length) {
      return this.version();
    }

    if(argv.help || argv.h) {
      return this._printHelpLines();
    }

    if(argv['stats-opt-out']) {
      var CameioStore = require('./cameio/store').CameioStore;
      var cameioConfig = new CameioStore('cameio.config');
      cameioConfig.set('statsOptOut', true);
      cameioConfig.save();
      console.log('Successful stats opt-out');
      return;
    }

    var taskSetting = this._tryBuildingTask();
    if(!taskSetting) {
      return this._printAvailableTasks();
    }
    var taskModule = require(taskSetting.module).CameioTask;

    var taskInstance = new taskModule();
    taskInstance.run(this);
  },

  fail: function(msg, taskHelp) {
    this.hasFailed = true;
    if(msg) {
      process.stderr.write(msg.error.bold);
      process.stderr.write( (' (CLI v' + settings.version + ')').error.bold + '\n');
    }
    if(taskHelp) {
      for(var i = 0; i < TASKS.length; i++) {
        var task = TASKS[i];
        if(task.name == taskHelp) {
          this.printUsage(task);
          process.stderr.write('\n');
          break;
        }
      }
    }
    process.stderr.write('\n');
    this.processExit(1);
  },

  version: function() {
    process.stderr.write(settings.version + '\n');
  },

  checkLatestVersion: function() {
    this.latestVersion = Q.defer();
    var self = this;

    try {
      if(settings.version.indexOf('beta') > -1) {
        // don't bother checking if its a beta
        self.latestVersion.resolve();
        return;
      }

      // stay silent if it errors
      var CameioStore = require('./cameio/store').CameioStore;
      var cameioConfig = new CameioStore('cameio.config');
      var versionCheck = cameioConfig.get('versionCheck');
      if(versionCheck && ((versionCheck + 86400000) > Date.now() )) {
        // we've recently checked for the latest version, so don't bother again
        self.latestVersion.resolve();
        return;
      }

      var proxy = process.env.PROXY || null;
      var request = require('request');
      request({ url: 'http://registry.npmjs.org/cameio/latest', proxy: proxy }, function(err, res, body) {
        try {
          self.npmVersion = JSON.parse(body).version;
          cameioConfig.set('versionCheck', Date.now());
          cameioConfig.save();
        } catch(e) {}
        self.latestVersion.resolve();
      });
    } catch(e) {
      self.latestVersion.resolve();
    }

  },

  printVersionWarning: function() {
    if(this.npmVersion && this.npmVersion != settings.version.trim()) {
      process.stdout.write('\n-------------------------\n'.red);
      process.stdout.write('Cameio CLI is out of date:\n'.bold.yellow);
      process.stdout.write( (' * Locally installed version: ' + settings.version + '\n').yellow );
      process.stdout.write( (' * Latest version: ' + this.npmVersion + '\n').yellow );
      process.stdout.write( ' * Run '.yellow + 'npm update -g cameio'.bold + ' to update\n'.yellow );
      process.stdout.write('-------------------------\n\n'.red);
      this.npmVersion = null;
    }
  },

  processExit: function(code) {
    this.latestVersion.promise.then(function(){
      process.exit(code);
    });
  },

  getContentSrc: function() {
    var self = this;
    var contentSrc;

    try {
      var fs = require('fs');
      var path = require('path');
      var configXmlPath = path.resolve('config.xml');
      if( !fs.existsSync(configXmlPath) ) {
        return 'index.html';
      }

      self.setConfigXml({
        resetContent: true,
        errorWhenNotFound: false
      });

      var configString = fs.readFileSync(configXmlPath, { encoding: 'utf8' });

      var xml2js = require('xml2js');
      var parseString = xml2js.parseString;
      parseString(configString, function (err, jsonConfig) {
        if(err) {
          return self.fail('Error parsing config.xml: ' + err);
        }
        try {
          contentSrc = jsonConfig.widget.content[0].$.src;
        } catch(e) {
          return self.fail('Error parsing ' + configXmlPath + ': ' + e);
        }
      });

    } catch(e) {
      return self.fail('Error loading ' + configXmlPath + ': ' + e);
    }

    return contentSrc;
  },

  /**
   * Download a zip file, unzip it to a specific folder.
   */
  fetchArchive: function(targetPath, archiveUrl) {
    var os = require('os');
    var fs = require('fs');
    var path = require('path');
    var unzip = require('unzip');
    var q = Q.defer();

    // The folder name the project will be downloaded and extracted to
    console.log('\nDownloading:'.bold, archiveUrl);

    var tmpFolder = os.tmpdir();
    var tempZipFilePath = path.join(tmpFolder, 'cameio-starter-' + new Date().getTime() + '.zip');


    var unzipRepo = function(fileName) {
      var readStream = fs.createReadStream(fileName);
      readStream.on('error', function(err) {
        console.log( ('unzipRepo readStream: ' + err).error );
        q.reject(err);
      });

      var writeStream = unzip.Extract({ path: targetPath });
      writeStream.on('close', function() {
        q.resolve();
      });
      writeStream.on('error', function(err) {
        console.log( ('unzipRepo writeStream: ' + err).error );
        q.reject(err);
      });
      readStream.pipe(writeStream);
    };

    var proxy = process.env.PROXY || null;
    var request = require('request');
    request({ url: archiveUrl, rejectUnauthorized: false, encoding: null, proxy: proxy }, function(err, res, body) {
      if(err) {
        console.error('Error fetching:'.error.bold, archiveUrl, err);
        q.reject(err);
        return;
      }
      if(!res) {
        console.error('Invalid response:'.error.bold, archiveUrl);
        q.reject('Unable to fetch response: ' + archiveUrl);
        return;
      }
      if(res.statusCode !== 200) {
        if(res.statusCode === 404 || res.statusCode === 406) {
          console.error('Not found:'.error.bold, archiveUrl, '(' + res.statusCode + ')');
          console.error('Please verify the url and try again.'.error.bold);
        } else {
          console.error('Invalid response status:'.error.bold, archiveUrl, '(' + res.statusCode + ')');
        }
        q.reject(res);
        return;
      }
      try {
        fs.writeFileSync(tempZipFilePath, body);
        unzipRepo(tempZipFilePath);
      } catch(e) {
        console.log('fetchArchive request write: ' + e);
        q.reject(e);
      }
    }).on('response', function(res){
      var ProgressBar = require('progress');
      var bar = new ProgressBar('[:bar]  :percent  :etas', {
        complete: '=',
        incomplete: ' ',
        width: 30,
        total: parseInt(res.headers['content-length'], 10)
      });

      res.on('data', function (chunk) {
        try {
          bar.tick(chunk.length);
        } catch(e){}
      });
    });

    return q.promise;
  },

  setConfigXml: function(options) {
    var fs = require('fs');
    var path = require('path');
    var xml2js = require('xml2js');
    var d = Q.defer();

    var self = this;
    var madeChange = false;

    try {
      var configXmlPath = path.resolve('config.xml');

      if(!fs.existsSync(configXmlPath)) {
        // working directory does not have the config.xml file
        if(options.errorWhenNotFound) {
          d.reject('Unable to locate config.xml file. Please ensure the working directory is at the root of the app where the config.xml should be located.');
        } else {
          d.resolve();
        }
        return d.promise;
      }

      var configString = fs.readFileSync(configXmlPath, { encoding: 'utf8' });

      var parseString = xml2js.parseString;
      parseString(configString, function (err, jsonConfig) {
        if(err) {
          d.reject(err);
          return self.fail('Error parsing ' + configXmlPath + ': ' + err);
        }

        if(options.devServer) {
          if( !jsonConfig.widget.content[0].$['original-src'] ) {
            jsonConfig.widget.content[0].$['original-src'] = jsonConfig.widget.content[0].$.src;
            madeChange = true;
          }
          if(jsonConfig.widget.content[0].$.src !== options.devServer) {
            jsonConfig.widget.content[0].$.src = options.devServer;
            madeChange = true;
          }

        } else if(options.resetContent) {

          if( jsonConfig.widget.content[0].$['original-src'] ) {
            jsonConfig.widget.content[0].$.src = jsonConfig.widget.content[0].$['original-src'];
            delete jsonConfig.widget.content[0].$['original-src'];
            madeChange = true;
          }
        }

        if(madeChange) {
          var xmlBuilder = new xml2js.Builder();
          configString = xmlBuilder.buildObject(jsonConfig);
          fs.writeFileSync(configXmlPath, configString);
        }

        d.resolve();
      });

    } catch(e) {
      d.reject(e);
      self.fail('Error updating ' + configXmlPath + ': ' + e);
    }

    return d.promise;
  }

};

exports.Cameio = Cameio;
