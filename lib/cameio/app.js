var fs = require('fs'),
    path = require('path'),
    parseUrl = require('url').parse,
    request = require('request'),
    argv = require('optimist').argv,
    FormData = require('form-data'),
    CameioProject = require('./project'),
    CameioTask = require('./task').CameioTask,
    CameioStats = require('./stats').CameioStats;
    Task = require('./task').Task,
    CameioLoginTask = require('./login').CameioTask,
    CameioUploadTask = require('./upload').CameioTask;

var CameioTask = function() {};

CameioTask.prototype = new Task();

CameioTask.prototype.run = function(cameio) {
  var self = this;

  self.cameio = cameio;
  self.inputValues = {};
  self.useCmdArgs = false;

  this.getCmdLineOptions();

  var login = new CameioLoginTask();
  login.get(cameio, function(jar) {
    self.jar = jar;

    if (argv['versions'] || argv.v) {
      self.versions(self);
    } else if (argv['deploy'] || argv.d) {
      if (!self.inputValues['uuid']) {
        // Deploying a new version
        var upload = new CameioUploadTask();

        upload.setNote(self.inputValues['note'] || '');
        upload.run(self.cameio, function() {
          self.deploy(self);
        });
      } else {
        self.deploy(self);
      }
    }
  });
};

CameioTask.prototype.versions = function(self) {
  var project = CameioProject.load();

  if (!project.get('app_id')) {
    console.log("No versions uploaded!".bold.red);
    return false;
  }

  var form = new FormData();
  form.append('csrfmiddlewaretoken', self.jar.cookies[0].value);

  var url = self.cameio.CAMEIO_DASH + self.cameio.CAMEIO_API + 'app/' + project.get('app_id') + '/versions';
  var params = parseUrl(url);

  form.submit({
      protocol: params.protocol,
      hostname: params.hostname,
      port: params.port,
      path: params.path,
      headers: form.getHeaders({
        cookie: self.jar.cookies.map(function (c) {
          return c.name + "=" + encodeURIComponent(c.value);
        }).join("; ")
      })
    },
    function (err, response) {
      if (err) {
        return self.cameio.fail('Error logging in: ' + err);
      }

      response.setEncoding('utf8');
      response.on("data", function(data) {
        try {
          var d = JSON.parse(data);
          if (d.errors && d.errors.length) {
            for (var j = 0; j < d.errors.length; j++) {
              console.log((d.errors[j]).bold.error);
            }
            return self.cameio.fail('Unable to fetch versions list');
          }

          var heading = ['    UUID   ', ' Created ', '            Note '];
          var heading_underline = ['------------', '----------', '----------------------------']

          console.log(heading.join('\t'));
          console.log(heading_underline.join('\t'));

          for (var j = 0; j < d.length; j++) {
            var active = (d[j].active) ? ' *' : '  ';
            var uuid = (d[j].active) ? d[j].uuid.substring(0,8).green : d[j].uuid.substring(0,8);
            var note = d[j].note.substring(0,25) || '\t';

            console.log([active + ' ' + uuid, ' ' + d[j].created, ' ' + note].join('\t'));
          }
        } catch(parseEx) {
          return self.cameio.fail('Error response: ' + parseEx);
        }
      });
    });
}

CameioTask.prototype.deploy = function(self) {
  var project = CameioProject.load();

  var url = self.cameio.CAMEIO_DASH + self.cameio.CAMEIO_API + 'app/' + project.get('app_id') + '/deploy';

  request({
      method: 'POST',
      url: url,
      jar: self.jar,
      form: {
        uuid: self.inputValues['uuid'],
        csrfmiddlewaretoken: self.jar.cookies[0].value
      },
      headers: {
        cookie: self.jar.cookies.map(function (c) {
          return c.name + "=" + encodeURIComponent(c.value);
        }).join("; ")
      }
    },
    function (err, response, body) {
      if (err) {
        return self.cameio.fail('Error deploying version: ' + err);
      }

      try {
        var d = JSON.parse(body);
        if (d.errors && d.errors.length) {
          for (var j = 0; j < d.errors.length; j++) {
            console.log((d.errors[j]).bold.error);
          }
          return self.cameio.fail('Unable to deploy version');
        }

        console.log("Successfully deployed " + d.uuid);

      } catch (parseEx) {
        return self.cameio.fail('Error response: ' + parseEx);
      }
    }
  );
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

  getCmdArgValue('note', 'n');
  getCmdArgValue('uuid', 'u');
};

exports.CameioTask = CameioTask;
