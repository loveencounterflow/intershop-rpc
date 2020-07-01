(function() {
  'use strict';
  var $, $async, $drain, $watch, CND, DATOM, NET, SP, alert, badge, cast, debug, echo, help, info, isa, jr, new_datom, rpr, select, type_of, urge, validate, warn, whisper;

  //###########################################################################################################
  CND = require('cnd');

  rpr = CND.rpr;

  badge = 'INTERSHOP-RPC/SERVER';

  debug = CND.get_logger('debug', badge);

  alert = CND.get_logger('alert', badge);

  whisper = CND.get_logger('whisper', badge);

  warn = CND.get_logger('warn', badge);

  help = CND.get_logger('help', badge);

  urge = CND.get_logger('urge', badge);

  info = CND.get_logger('info', badge);

  echo = CND.echo.bind(CND);

  //...........................................................................................................
  // FS                        = require 'fs'
  // PATH                      = require 'path'
  NET = require('net');

  //...........................................................................................................
  SP = require('steampipes');

  ({$, $async, $watch, $drain} = SP.export());

  //...........................................................................................................
  DATOM = require('datom');

  ({new_datom, select} = DATOM.export());

  //...........................................................................................................
  this.types = require('./types');

  ({isa, validate, cast, type_of} = this.types);

  //...........................................................................................................
  ({jr} = CND);

  //-----------------------------------------------------------------------------------------------------------
  this.new_server = function(me, settings) {
    var R, defaults;
    defaults = {
      socket_log_all: false,
      socketserver_log_all: false
    };
    settings = {...defaults, ...settings};
    R = {};
    R.xemitter = DATOM.new_xemitter();
    R.stop = function() {
      return R.socketserver.close();
    };
    //.........................................................................................................
    R.socketserver = NET.createServer((socket) => {
      var pipeline, source;
      R.socket = socket;
      if (settings.socket_log_all) {
        this._socket_listen_on_all(socket);
      }
      R.counts = {
        requests: 0,
        rpcs: 0,
        hits: 0,
        fails: 0,
        errors: 0
      };
      R.show_counts = false;
      R.count_interval = 1000;
      socket.on('data', (data) => {
        if (data !== '') {
          return source.send(data);
        }
      });
      socket.on('error', (error) => {
        return warn(`socket error: ${error.message}`);
      });
      source = SP.new_push_source();
      pipeline = [];
      //.......................................................................................................
      pipeline.push(source);
      pipeline.push(SP.$split());
      // pipeline.push $watch ( d ) => urge '^3398^', jr d
      pipeline.push(this.$show_counts(me));
      pipeline.push(this.$dispatch(me));
      pipeline.push($drain());
      //.......................................................................................................
      SP.pull(...pipeline);
      return null;
    });
    if (settings.socketserver_log_all) {
      //.........................................................................................................
      this._server_listen_on_all(R.socketserver);
    }
    return R;
  };

  //-----------------------------------------------------------------------------------------------------------
  this.start = function(me) {
    return new Promise((resolve, reject) => {
      var host;
      //.........................................................................................................
      process.on('uncaughtException', async() => {
        await this.stop(me);
        return process.exitCode = 1;
      });
      process.on('unhandledRejection', async() => {
        await this.stop(me);
        return process.exitCode = 1;
      });
      /* TAINT setting these as constants FTTB */
      // host = 'localhost'
      host = '127.0.0.1';
      me.server.socketserver.listen(me.port, host, () => {
        var app_name, family, port, ref;
        ({
          address: host,
          port,
          family
        } = me.server.socketserver.address());
        app_name = (ref = process.env['intershop_db_name']) != null ? ref : 'intershop';
        help(`RPC server for ${app_name} listening on ${family} ${host}:${port}`);
        return resolve(null);
      });
      return null;
    });
  };

  //-----------------------------------------------------------------------------------------------------------
  this.stop = function(me) {
    return new Promise((resolve, reject) => {
      return me.server.socketserver.close((error) => {
        if (error != null) {
          return reject(error);
        }
        return resolve(null);
      });
    });
  };

  //-----------------------------------------------------------------------------------------------------------
  this.$show_counts = function(me) {
    return $watch(function(event) {
      me.server.counts.requests += +1;
      if (me.server.show_counts && (me.server.counts.requests % me.server.count_interval) === 0) {
        urge(JSON.stringify(me.server.counts));
      }
      return null;
    });
  };

  //-----------------------------------------------------------------------------------------------------------
  this.$dispatch = function(me) {
    return $((line, send) => {
      var $rsvp, error, event, method, method_name, parameters, ref, type;
      if (line === '') {
        return null;
      }
      event = null;
      method = null;
      parameters = null;
      $rsvp = false;
      while (true) {
        try {
          /* TAINt first parse format to be prepended, as in e.g. `json:{}` */
          //.......................................................................................................
          event = JSON.parse(line);
        } catch (error1) {
          error = error1;
          this.send_error(me, `^rpc-secondary/$dispatch@1357^
An error occurred while trying to parse ${rpr(line)}:
${error.message}`);
          break;
        }
        //.....................................................................................................
        switch (type = type_of(event)) {
          case 'object':
            method_name = event.$key;
            parameters = event.$value;
            $rsvp = (ref = event.$rsvp) != null ? ref : false;
            break;
          default:
            this.send_error(me, `^rpc-secondary/$dispatch@1359^ expected object, got a ${type}: ${rpr(event)}`);
            break;
        }
        //.....................................................................................................
        switch (method_name) {
          case 'error':
            this.send_error(me, parameters);
            break;
          //...................................................................................................
          case 'stop':
            /* TAINT really exit process? */
            process.exit();
            break;
          default:
            //...................................................................................................
            if ($rsvp === true) {
              /* TAINT `@do_rpc() is async */
              this.do_rpc(me, method_name, parameters);
            }
        }
        //.....................................................................................................
        break;
      }
      //.......................................................................................................
      /* TAINT sending on failed lines w/out marking them as such? */
      send(event != null ? event : line);
      return null;
    });
  };

  //-----------------------------------------------------------------------------------------------------------
  this.do_rpc = async function(me, method_name, parameters) {
    var result;
    me.server.counts.rpcs += +1;
    help('^intershop-rpc/server/do_rpc@5567^', result = (await me.delegate(method_name, parameters)));
    if (isa.promise(result)) {
      result.then((result) => {
        return this._write(me, method_name, result);
      });
    } else {
      this._write(me, method_name, result);
    }
    return null;
  };

  //-----------------------------------------------------------------------------------------------------------
  this.send_error = function(me, message) {
    return this._write(me, 'error', message);
  };

  //-----------------------------------------------------------------------------------------------------------
  this._write = function(me, $method, parameters) {
    var d;
    // debug '^intershop-rpc-server-secondary.coffee@1362^', ( rpr method_name ), ( rpr parameters )
    // if isa.object parameters  then  d = new_datom '^rpc-result', { $method, parameters..., }
    // else                            d = new_datom '^rpc-result', { $method, $value: parameters, }
    d = new_datom('^rpc-result', {
      $method,
      $value: parameters
    });
    me.server.socket.write((JSON.stringify(d)) + '\n');
    return null;
  };

  //-----------------------------------------------------------------------------------------------------------
  this._socket_listen_on_all = function(socket) {
    /* TAINT add arguments, timestamp */
    socket.on('close', function(...P) {
      return whisper('^intershop-rpc@4432-1^', 'socket:close'); // , ( rpr P )[ .. 100 ]
    });
    socket.on('connect', function(...P) {
      return whisper('^intershop-rpc@4432-2^', 'socket:connect'); // , ( rpr P )[ .. 100 ]
    });
    socket.on('data', function(...P) {
      return whisper('^intershop-rpc@4432-3^', 'socket:data'); // , ( rpr P )[ .. 100 ]
    });
    socket.on('drain', function(...P) {
      return whisper('^intershop-rpc@4432-4^', 'socket:drain'); // , ( rpr P )[ .. 100 ]
    });
    socket.on('end', function(...P) {
      return whisper('^intershop-rpc@4432-5^', 'socket:end'); // , ( rpr P )[ .. 100 ]
    });
    socket.on('error', function(...P) {
      return whisper('^intershop-rpc@4432-6^', 'socket:error'); // , ( rpr P )[ .. 100 ]
    });
    socket.on('lookup', function(...P) {
      return whisper('^intershop-rpc@4432-7^', 'socket:lookup'); // , ( rpr P )[ .. 100 ]
    });
    socket.on('timeout', function(...P) {
      return whisper('^intershop-rpc@4432-8^', 'socket:timeout'); // , ( rpr P )[ .. 100 ]
    });
    return null;
  };

  //-----------------------------------------------------------------------------------------------------------
  this._server_listen_on_all = function(socketserver) {
    /* TAINT add arguments, timestamp */
    socketserver.on('close', function(...P) {
      return whisper('^intershop-rpc@4432-9^', 'socketserver:close'); // , ( rpr P )[ .. 100 ]
    });
    socketserver.on('connection', function(...P) {
      return whisper('^intershop-rpc@4432-10^', 'socketserver:connection'); // , ( rpr P )[ .. 100 ]
    });
    socketserver.on('error', function(...P) {
      return whisper('^intershop-rpc@4432-11^', 'socketserver:error'); // , ( rpr P )[ .. 100 ]
    });
    socketserver.on('listening', function(...P) {
      return whisper('^intershop-rpc@4432-12^', 'socketserver:listening'); // , ( rpr P )[ .. 100 ]
    });
    return null;
  };

}).call(this);

//# sourceMappingURL=server.js.map