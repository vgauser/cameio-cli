var fs = require('fs'),
    request = require('request'),
    argv = require('optimist').argv,
    prompt = require('prompt'),
    CameioProject = require('./project'),
    CameioStore = require('./store').CameioStore,
    Task = require('./task').Task;

var CameioTask = function() {};

CameioTask.prototype = new Task();

CameioTask.prototype.get = function(cameio, callback) {
  this.cookieData = new CameioStore('cookies');

  if(cameio.jar) {
    // already in memory
    callback(cameio.jar);
    return;
  }

  this.email = argv.email || argv.e || process.env.CAMEIO_EMAIL;
  this.password = argv.password || argv.p || process.env.CAMEIO_PASSWORD;

  if(!this.email && this.password) {
    return cameio.fail('--email or -e command line flag, or CAMEIO_EMAIL environment variable required');
  }
  if(this.email && !this.password) {
    return cameio.fail('--password or -p command line flag, or CAMEIO_PASSWORD environment variable required');
  }

  if(!this.email && !this.password) {
    // did not include cmd line flags, check for existing cookies
    var jar = this.cookieData.get(cameio.CAMEIO_DASH);

    if(jar && jar.cookies && jar.cookies.length) {
      for(var i in jar.cookies) {
        var cookie = jar.cookies[i];
        if(cookie.name == "sessionid" && new Date(cookie.expires) > new Date()) {
          cameio.jar = jar;
          callback(jar);
          return;
        }
      }
    }
  }

  this.run(cameio, callback);
};

CameioTask.prototype.run = function(cameio, callback) {
  var self = this;

  if(!this.email && !this.password) {

    var schema = [{
      name: 'email',
      pattern: /^[A-z0-9!#$%&'*+\/=?\^_{|}~\-]+(?:\.[A-z0-9!#$%&'*+\/=?\^_{|}~\-]+)*@(?:[A-z0-9](?:[A-z0-9\-]*[A-z0-9])?\.)+[A-z0-9](?:[A-z0-9\-]*[A-z0-9])?$/,
      description: 'Email:'.yellow.bold,
      required: true
    }, {
      name: 'password',
      description: 'Password:'.yellow.bold,
      hidden: true,
      required: true
    }];

    // prompt for log
    console.log('\nTo continue, please login to your Cameio account.'.bold.green);
    console.log('Don\'t have one? Create a one at: '.bold + (cameio.CAMEIO_DASH + '/signup').bold + '\n');

    prompt.override = argv;
    prompt.message = '';
    prompt.delimiter = '';
    prompt.start();

    prompt.get(schema, function (err, result) {
      if(err) {
        return cameio.fail('Error logging in: ' + err);
      }

      self.email = result.email;
      self.password = result.password;

      self.requestLogIn(cameio, callback, true);
    });

  } else {
    // cmd line flag were added, use those instead of a prompt
    self.requestLogIn(cameio, callback, false);
  }

};

CameioTask.prototype.requestLogIn = function(cameio, callback, saveCookies) {
  var self = this;

  var jar = request.jar();
  request({
    method: 'POST',
    url: cameio.CAMEIO_DASH + cameio.CAMEIO_API + 'user/login',
    jar: jar,
    form: {
      username: self.email.toString().toLowerCase(),
      password: self.password
    },
    proxy: process.env.PROXY || null
  },
  function (err, response, body) {
    if(err) {
      return cameio.fail('Error logging in: ' + err);
    }

    // Should be a 302 redirect status code if correct
    if(response.statusCode != 200) {
      return cameio.fail('Email or Password incorrect. Please visit '+ cameio.CAMEIO_DASH.white +' for help.'.red);
    }

    if(saveCookies) {
      // save cookies
      if(!self.cookieData) {
        self.cookieData = new CameioStore('cookies');
      }
      self.cookieData.set(cameio.CAMEIO_DASH, jar);
      self.cookieData.save();
    }

    // save in memory
    cameio.jar = jar;

    console.log('Logged in! :)'.green);

    if(callback) {
      callback(jar);
    }
  });
};

exports.CameioTask = CameioTask;
