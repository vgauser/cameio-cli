var fs = require('fs'),
    request = require('request'),
    path = require('path'),
    parseUrl = require('url').parse,
    argv = require('optimist').argv,
    prompt = require('prompt'),
    shelljs = require('shelljs/global'),
    FormData = require('form-data'),
    CameioProject = require('./project'),
    CameioStore = require('./store').CameioStore,
    Task = require('./task').Task,
    CameioUploadTask = require('./upload').CameioTask,
    CameioStats = require('./stats').CameioStats,
    CameioLoginTask = require('./login').CameioTask;

var CameioTask = function() {};

CameioTask.prototype = new Task();

CameioTask.prototype.run = function(cameio) {
  var self = this;
  self.cameio = cameio;

  self.project = CameioProject.load();
  self.inputFiles = {};
  self.inputValues = {};
  self.useCmdArgs = false;

  CameioStats.t();

  if(argv['clear-signing'] || argv.l) {
    self.clearSigning();
    return;
  }

  self.loadProject();

  this.getCmdLineOptions();

  if(self.cameio.hasFailed) return;

  var login = new CameioLoginTask();
  login.get(self.cameio, function(jar) {
    self.jar = jar;

    self.loadAppSigning(function(){
      self.initPlatforms();
    });
  });

};


CameioTask.prototype.loadProject = function() {
  var appName = this.project.get('name') || "app";
  console.log( ('Loading ' + appName + '...').bold.green );

  if(argv._.length < 3) {
    return this.cameio.fail('No platforms or build mode specified.', 'package');
  }

  this.mode = argv._[2].toLowerCase();
  if(this.mode != 'debug' && this.mode != 'release') {
    // cameio package debug android
    this.mode = argv._[1].toLowerCase();
    this.platforms = argv._.slice(2);
  } else {
    // cameio package android debug
    this.platforms = [ argv._[1].toLowerCase() ];
  }

  if(this.mode != 'debug' && this.mode != 'release') {
    return this.cameio.fail('Package build mode must be "debug" or "release".', 'package');
  }

  if(this.platforms.length < 1) {
    return this.cameio.fail('No platforms specified.', 'package');
  }

  this.buildStatusEmail = (!argv['no-email'] && !argv.n);

  this.loadPlugins();
};


CameioTask.prototype.loadPlugins = function() {
  this.plugins = [];

  try {
    var pluginsPath = resolvePath('./plugins/');
    var pluginDirs = fs.readdirSync(pluginsPath);

    for(var x=0; x<pluginDirs.length; x++) {
      try {
        var plugingPackage = resolvePath(pluginsPath + '/' + pluginDirs[x] + '/package.json');
        var packageObj = JSON.parse( fs.readFileSync(plugingPackage, { encoding: 'utf8' }) );
        if(packageObj.repo || packageObj.name) {
          this.plugins.push(packageObj);
        }
      } catch(e) {}
    }
  } catch(pluginError) {
    return this.cameio.fail('Unable to find plugin directory. Make sure the working directory is an Cameio project.');
  }
};


CameioTask.prototype.getCmdLineOptions = function() {
  var self = this;

  function getCmdArgValue(propertyName, shortName) {
    var value = argv[propertyName] || argv[shortName];
    if(value) {
      self.inputValues[propertyName] = value;
      self.useCmdArgs = true;
    }
  }

  function getCmdArgFile(propertyName, shortName) {
    var value = argv[propertyName] || argv[shortName];
    if(value) {
      if(!fileExists(value)) {
        return self.cameio.fail("Unable to find file: " + argv[propertyName]);
      }
      self.inputFiles[propertyName] = value;
      self.useCmdArgs = true;
    }
  }

  getCmdArgValue('android-keystore-alias', 'a');
  getCmdArgValue('android-keystore-password', 'w');
  getCmdArgValue('android-key-password', 'r');
  getCmdArgValue('ios-certificate-password', 'd');

  getCmdArgFile('android-keystore-file', 'k');
  getCmdArgFile('ios-certificate-file', 'c');
  getCmdArgFile('ios-profile-file', 'f');
};


CameioTask.prototype.loadAppSigning = function(callback) {
  var self = this;

  if(self.useCmdArgs) {
    // if they used cmd line args, don't bother checking
    callback();
    return;
  }

  if(!self.project.get('app_id')) {
    // if its the first load we won't have an appId yet
    callback();
    return;
  }

  var privateData = new CameioStore(self.project.get('app_id'));
  var cck = privateData.get('cck');
  if(!cck) {
    // if there's no client key don't bother
    callback();
    return;
  }

  var options = {
    url: self.cameio.CAMEIO_DASH + self.cameio.CAMEIO_API + 'app/' + self.project.get('app_id') + '/signing',
    headers: {
      cookie: self.jar.cookies.map(function (c) {
        return c.name + "=" + encodeURIComponent(c.value);
      }).join("; "),
      cck: cck
    },
    proxy: process.env.PROXY || null
  };

  request(options, function(err, response, body) {
    if(err) {
      return self.cameio.fail("Error loading app signing info: " + err);
    }

    if(response.statusCode == 200) {
      try {
        self.signing = JSON.parse(body);

        if(!self.signing) {
          return self.cameio.fail("Invalid app signing information");
        }

      } catch(e) {
        return self.cameio.fail("Error parsing app signing: " + e);
      }
    }

    callback();
  });
};


CameioTask.prototype.initPlatforms = function() {
  var self = this;

  if(self.useCmdArgs) {
    self.packagePlatforms();

  } else {
    prompt.override = argv;
    prompt.message = '';
    prompt.delimiter = '';
    prompt.start();

    var promptProperties = self.buildPromptProperties();

    prompt.get({properties: promptProperties}, function (err, promptResult) {
      if(err) {
        return self.cameio.fail('Error packaging: ' + err);
      }

      for(var propertyName in promptResult) {
        var promptValue = promptResult[propertyName];
        if( !promptValue ) continue;

        if(promptProperties[propertyName].isFile) {
          self.inputFiles[propertyName] = promptValue;
        } else {
          self.inputValues[propertyName] = promptValue;
        }
      }

      self.packagePlatforms();
    });
  }

};

CameioTask.prototype.packagePlatforms = function() {
  var self = this;
  var upload = new CameioUploadTask();

  upload.run(self.cameio, function() {
    for(var x=0; x<self.platforms.length; x++) {
      var form = self.buildPostRequest(self.platforms[x]);
      self.submitPostRequest(form, self.platforms[x]);
    }
  });
};


CameioTask.prototype.buildPromptProperties = function() {
  // Just prompt for some build properties
  var promptProperties = {};

  for(var x=0; x<this.platforms.length; x++) {

    if(this.platforms[x] == 'android') {

      // Android debug doesn't require anything
      if(this.mode == 'release') {

        promptProperties['android-keystore-file']= {
          name: 'android-keystore-file',
          description: 'Android Keystore File (.keystore):'.yellow.bold,
          required: true,
          conform: fileExists,
          isFile: true
        };

        promptProperties['android-keystore-alias'] = {
          name: 'android-keystore-alias',
          description: 'Keystore Alias:'.yellow.bold.yellow.bold,
          required: true
        };

        promptProperties['android-keystore-password'] = {
          name: 'android-keystore-password',
          description: 'Keystore Password:'.yellow.bold,
          hidden: true,
          required: true
        };

        promptProperties['android-key-password'] = {
          name: 'android-key-password',
          description: 'Key Password (optional):'.yellow.bold,
          hidden: true
        };
      }

    } else if(this.platforms[x] == 'ios') {
      // iOS
      promptProperties['ios-certificate-file'] = {
        name: 'ios-certificate-file',
        description: 'iOS Certificate File (.p12):'.yellow.bold,
        required: true,
        conform: fileExists,
        isFile: true
      };

      promptProperties['ios-certificate-password'] = {
        name: 'ios-certificate-password',
        description: 'Certificate Password:'.yellow.bold,
        hidden: true,
        required: true
      };

      promptProperties['ios-profile-file'] = {
        name: 'ios-profile-file',
        description: 'iOS Mobile Provisioning Profile (.mobileprovision):'.yellow.bold,
        required: true,
        conform: fileExists,
        isFile: true
      };

    }

  }

  // Don't prompt for properties we already have stored on the server
  if(this.signing){
    for (var propertyName in promptProperties) {
      if(this.signing['is_valid_' + propertyName.replace(/-/g, '_')]) {
        delete promptProperties[propertyName];
      }
    }
  }

  return promptProperties;
};


CameioTask.prototype.buildPostRequest = function(platform) {
  var form = new FormData();

  form.append('build_status_email', this.buildStatusEmail.toString());
  form.append('name', this.project.get('name') || '');
  form.append('platform', platform);
  form.append('build_mode', this.mode);
  form.append('csrfmiddlewaretoken', this.jar.cookies[0].value);

  for (var i = 0; i < this.plugins.length; i++) {
    form.append('plugin_' + i, this.plugins[i].repo ? this.plugins[i].repo : this.plugins[i].name);
    if(this.plugins[i].name) {
      form.append('plugin_' + i + '_name', this.plugins[i].name);
    }
    if(this.plugins[i].version) {
      form.append('plugin_' + i + '_version', this.plugins[i].version);
    }
  }

  for(var propertyName in this.inputValues) {
    form.append(propertyName.replace(/-/g, '_'), this.inputValues[propertyName]);
  }

  for(propertyName in this.inputFiles) {
    var inputFile = this.inputFiles[propertyName];
    if( !inputFile ) continue;

    try {
      inputFile = inputFile.replace(/\\ /g, ' ').trim();
      form.append(propertyName.replace(/-/g, '_'), fs.createReadStream( resolvePath(inputFile) ) );
    } catch(e) {
      return this.cameio.fail("Error loading " + resolvePath(inputFile));
    }
  }

  var configFilePath = resolvePath('./config.xml');
  if(fs.existsSync(configFilePath)){
    var xmlString = fs.readFileSync(configFilePath, { encoding: 'utf8' });
    form.append('config_file', xmlString);
  }

  return form;
};


CameioTask.prototype.submitPostRequest = function(form, platform) {
  var self = this;
  var params = parseUrl(self.cameio.CAMEIO_DASH + self.cameio.CAMEIO_API + 'app/' + self.project.get('app_id') + '/package');

  var privateData = new CameioStore(this.project.get('app_id'));

  console.log( (platform + ' ' + self.mode + ' building...').bold );

  form.submit({
    protocol: params.protocol,
    hostname: params.hostname,
    port: params.port,
    path: params.path,
    headers: form.getHeaders({
      cookie: self.jar.cookies.map(function (c) {
        return c.name + "=" + encodeURIComponent(c.value);
      }).join("; "),
      cck: privateData.get('cck')
    })
  },
  function(err, response) {
    if(err) {
      return self.cameio.fail("Error packaging " + platform + ": " + err);
    }

    response.setEncoding('utf8');
    response.on("data", function(data) {
      try {
        var d = JSON.parse(data);

        if(d.errors && d.errors.length) {
          for (var j = 0; j < d.errors.length; j++) {
            console.log( d.errors[j].bold.error );
          }
          console.log('');

        } else if(d.build_status_url) {
          process.stderr.write('.');
          setTimeout(function(){
            var requestOptions = {
              url: d.build_status_url,
              headers: {
                cookie: self.jar.cookies.map(function (c) {
                  return c.name + "=" + encodeURIComponent(c.value);
                }).join("; ")
              }
            };
            pingBuildStatus(self.cameio, requestOptions, platform, 1);
          }, 5000);
        }

        if(d.cck) {
          var privateData = new CameioStore(self.project.get('app_id'));
          privateData.set('cck', d.cck);
          privateData.save();
        }

        if(d.app_id) {
          self.project.set('app_id', d.app_id);
        }
        if(d.name) {
          self.project.set('name', d.name);
        }
        self.project.save();

      } catch(e) {
        return self.cameio.fail('Error submitPostRequest: ' + e);
      }
    });

  });
};


CameioTask.prototype.clearSigning = function() {
  var self = this;
  console.log('Clearing app signing and credential information...'.yellow.bold);

  var appId = self.project.get('app_id');

  if(!appId) {
    return self.cameio.fail('App Id is not known');
  }

  var login = new CameioLoginTask();
  login.get(self.cameio, function(jar) {
    var options = {
      url: self.cameio.CAMEIO_DASH + self.cameio.CAMEIO_API + 'app/' + appId + '/signing/clear',
      headers: {
        cookie: jar.cookies.map(function (c) {
          return c.name + "=" + encodeURIComponent(c.value);
        }).join("; ")
      },
      proxy: process.env.PROXY || null
    };

    request(options, function(err, response, body) {
      if(err) {
        return self.cameio.fail("Error clearing app signing: " + err);
      }
      console.log( ('App (' + appId + ') signing and credential information cleared\n').green.bold );
    });
  });
};


function pingBuildStatus(cameio, requestOptions, platform, attempt) {
  process.stderr.clearLine();
  process.stderr.cursorTo(0);

  for(var x=0; x<attempt; x++) {
    process.stderr.write('.');
  }

  request(requestOptions, function(err, response, body) {
    if(err) {
      return cameio.fail("\nError pinging build status: " + err);
    }

    try {
      var d = JSON.parse(body);

      if(d.errors && d.errors.length) {
        for(var x=0; x<d.errors.length; x++) {
          console.log( ('\n' + d.errors[x]).bold.red );
        }
        return;
      }

      if(d.message) {
        console.log( ('\n' + d.message).bold.red );
      }

      // STATUS_INITIALIZED = 0
      // STATUS_QUEUED      = 1
      // STATUS_BUILDING    = 2
      // STATUS_SUCCESS     = 3
      // STATUS_FAILED      = 4

      if(d.status >= 0 && d.status < 3) {
        // still queued/building
        attempt++;

        if(attempt > 60) {
          return cameio.fail("\nUnable to receive build status");
        }

        setTimeout(function(){
          pingBuildStatus(cameio, requestOptions, platform, attempt);
        }, 5000);

      } else if(d.status == 4) {
        console.log("Use 'cameio package --clear-signing' to clear app signing and credential data if needed.".bold.red);
        return cameio.fail("Build failed");
      } else if(d.status == 3) {
        downloadBuildPackage(platform, d);
      } else {
        return cameio.fail("\nError receiving build status");
      }

    } catch(e) {
      return cameio.fail("\nError pinging build status: " + e);
    }

  });
}


function downloadBuildPackage(platform, data) {
  console.log( ('\n\n' + platform + ' build complete, downloading package...').bold );

  var filePath = argv.output;

  if(!filePath) {
    var dirPath = resolvePath('./packages');
    filePath = resolvePath(dirPath + '/' + data.package_filename);

    if(!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
  }

  var file = fs.createWriteStream(filePath);

  var proxy = process.env.PROXY || null;
  request({ url: data.package_url, proxy: proxy }, function(err, res, body) {
    if(res.statusCode !== 200) {
      console.error( (err).red );
      return;
    }
    try {
      file.write(body);
      file.close(function(){
        console.log( ('Saved ' + platform + ' package: ' + filePath + '\n').bold.green );
      });
    } catch(e) {
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

    res.on('end', function () {
      console.log('\n');
    });

  }).on('error', function(err) {
    try {
      fs.unlink(filePath);
    } catch(e) {
      console.error( (e).red );
    }
    console.error( (err).red );
  });
}


function fileExists(filePath) {
  // check if a file exists with a relative path or absolute path
  filePath = filePath.replace(/\\ /g, ' ').trim();
  return fs.existsSync(resolvePath(filePath));
}

function resolvePath (p) {
  if (p.substr(0, 1) === '~') {
    p = process.env.HOME + p.substr(1);
  }
  return path.resolve(p);
}

exports.CameioTask = CameioTask;
