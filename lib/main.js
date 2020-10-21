(function() {
  'use strict';
  var $, $async, $drain, $watch, CND, DATOM, Multimix, NET, Rpc, SP, _defaults, alert, badge, cast, debug, echo, freeze, help, info, isa, jr, new_datom, rpr, select, type_of, urge, validate, warn, whisper,
    boundMethodCheck = function(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new Error('Bound instance method accessed before binding'); } };

  //###########################################################################################################
  CND = require('cnd');

  rpr = CND.rpr;

  badge = 'INTERSHOP-RPC';

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

  ({new_datom, freeze, select} = DATOM.export());

  //...........................................................................................................
  this.types = new (require('intertype')).Intertype();

  ({isa, validate, cast, type_of} = this.types);

  //...........................................................................................................
  jr = JSON.stringify;

  Multimix = require('multimix');

  //...........................................................................................................
  _defaults = freeze({
    host: 'localhost',
    port: 23001,
    show_counts: true,
    count_interval: 1000,
    socket_log_all: false,
    socketserver_log_all: false,
    logging: true
  });

  //===========================================================================================================

  //-----------------------------------------------------------------------------------------------------------
  this.types.declare('intershop_rpc_settings', {
    tests: {
      "x is a object": function(x) {
        return this.isa.object(x);
      },
      "x.host is a nonempty_text": function(x) {
        return this.isa.nonempty_text(x.host);
      },
      "x.port is a count": function(x) {
        return this.isa.count(x.port);
      },
      "x.show_counts is a boolean": function(x) {
        return this.isa.boolean(x.show_counts);
      },
      "x.count_interval is a positive_integer": function(x) {
        return this.isa.positive_integer(x.count_interval);
      },
      "x.socket_log_all is a boolean": function(x) {
        return this.isa.boolean(x.socket_log_all);
      },
      "x.socketserver_log_all is a boolean": function(x) {
        return this.isa.boolean(x.socketserver_log_all);
      },
      "x.logging is a boolean or a function": function(x) {
        return (this.isa.boolean(x.logging)) || (this.isa.function(x.logging));
      }
    }
  });

  Rpc = (function() {
    //===========================================================================================================

    //-----------------------------------------------------------------------------------------------------------
    class Rpc extends Multimix {
      //=========================================================================================================

      //---------------------------------------------------------------------------------------------------------
      constructor(settings) {
        var method;
        super();
        //---------------------------------------------------------------------------------------------------------
        this._log = this._log.bind(this);
        this.settings = {..._defaults, ...settings};
        validate.intershop_rpc_settings(this.settings);
        this.settings.address = `${this.settings.host}:${this.settings.port}`;
        this.settings = freeze(this.settings);
        this._xemitter = DATOM.new_xemitter();
        this.counts = {
          requests: 0,
          rpcs: 0,
          hits: 0,
          fails: 0,
          errors: 0
        };
        this._socketserver = this._create_socketserver();
        if (this.settings.socket_log_all) {
          //.......................................................................................................
          this._socket_listen_on_all();
        }
        if (this.settings.socketserver_log_all) {
          this._server_listen_on_all();
        }
        //.......................................................................................................
        if (this.settings.logging !== false) {
          method = this.settings.logging === true ? this._log : this.settings.logging;
          this.listen_to('^log', method);
        }
        return this;
      }

      //---------------------------------------------------------------------------------------------------------
      static async create(settings) {
        /* Convenience method to instantiate and start server */
        var R;
        R = new this(settings);
        await R.start();
        return R;
      }

      //---------------------------------------------------------------------------------------------------------
      _create_socketserver() {
        return NET.createServer((socket) => {
          var pipeline, source;
          this._socket = socket;
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
          // pipeline.push $watch ( d ) => debug '^3398^', rpr d.toString()
          pipeline.push(SP.$split());
          pipeline.push(this._$show_counts());
          pipeline.push(this._$dispatch());
          pipeline.push($drain());
          //.......................................................................................................
          SP.pull(...pipeline);
          return null;
        });
      }

      //---------------------------------------------------------------------------------------------------------
      start() {
        return new Promise((resolve, reject) => {
          process.on('uncaughtException', async(error) => {
            await this.stop();
            process.exitCode = 1;
            return reject(error);
          });
          process.on('unhandledRejection', async(error) => {
            await this.stop();
            process.exitCode = 1;
            return reject(error);
          });
          this._socketserver.listen(this.settings.port, this.settings.host, () => {
            /* TAINT do in constructor? or add to settings? */
            var app_name, family, host, port, ref;
            ({
              address: host,
              port,
              family
            } = this._socketserver.address());
            app_name = (ref = process.env['intershop_db_name']) != null ? ref : 'intershop';
            help(`^intershop-rpc/main/start@398^ RPC server for ${app_name} listening on ${family} ${host}:${port}`);
            return resolve(null);
          });
          //.......................................................................................................
          return null;
        });
      }

      //---------------------------------------------------------------------------------------------------------
      stop() {
        return new Promise((resolve, reject) => {
          if (this._socket != null) {
            this._socket.destroy();
          }
          // return resolve() if @_socketserver.
          this._socketserver.close((error) => {
            if (error != null) {
              return reject(error);
            }
            help("^intershop-rpc/main/start@397^ RPC server stopped");
            return resolve(null);
          });
          //.......................................................................................................
          return null;
        });
      }

      _log(d) {
        var ref, value, x;
        boundMethodCheck(this, Rpc);
        if (isa.list((value = (ref = d.$value) != null ? ref : d))) {
          value = ((function() {
            var i, len, results;
            results = [];
            for (i = 0, len = value.length; i < len; i++) {
              x = value[i];
              results.push(isa.text(x) ? x : rpr(x));
            }
            return results;
          })()).join(' ');
        }
        return echo(CND.grey(this.settings.address + ' RPC:'), CND.yellow(value));
      }

      //=========================================================================================================

      //---------------------------------------------------------------------------------------------------------
      _$show_counts() {
        return $watch((event) => {
          this.counts.requests += +1;
          if (this.settings.show_counts && (this.counts.requests % this.settings.count_interval) === 0) {
            urge(jr(this.counts));
          }
          return null;
        });
      }

      //---------------------------------------------------------------------------------------------------------
      _$dispatch() {
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
              this.send_error(`^rpc-secondary/$dispatch@1357^
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
                this.send_error(`^rpc-secondary/$dispatch@1359^ expected object, got a ${type}: ${rpr(event)}`);
                break;
            }
            //.....................................................................................................
            switch (method_name) {
              case 'error':
                this.send_error(parameters);
                break;
              //...................................................................................................
              case 'stop':
                /* TAINT really exit process? */
                process.exit();
                break;
              default:
                //...................................................................................................
                if ($rsvp === true) {
                  this.do_rpc(method_name, parameters);
                } else {
                  this.emit(method_name, parameters);
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
      }

      //---------------------------------------------------------------------------------------------------------
      async do_rpc(method_name, parameters) {
        var result;
        this.counts.rpcs += +1;
        result = (await this.delegate(method_name, parameters));
        // help '^intershop-rpc/server/do_rpc@5567^', { result, }
        if (isa.promise(result)) {
          result.then((result) => {
            return this._write(method_name, result);
          });
        } else {
          this._write(method_name, result);
        }
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      send_error(message) {
        return this._write('error', message);
      }

      //---------------------------------------------------------------------------------------------------------
      _write($method, parameters) {
        var d;
        // debug '^intershop-rpc-server-secondary.coffee@1362^', ( rpr method_name ), ( rpr parameters )
        // if isa.object parameters  then  d = new_datom '^rpc-result', { $method, parameters..., }
        // else                            d = new_datom '^rpc-result', { $method, $value: parameters, }
        d = new_datom('^rpc-result', {
          $method,
          $value: parameters
        });
        this._socket.write((jr(d)) + '\n');
        return null;
      }

      //=========================================================================================================
      // XEMITTER METHODS
      //---------------------------------------------------------------------------------------------------------
      contract(...P) {
        return this._xemitter.contract(...P);
      }

      listen_to(...P) {
        return this._xemitter.listen_to(...P);
      }

      listen_to_all(...P) {
        return this._xemitter.listen_to_all(...P);
      }

      listen_to_unheard(...P) {
        return this._xemitter.listen_to_unheard(...P);
      }

      emit(...P) {
        return this._xemitter.emit(...P);
      }

      delegate(...P) {
        return this._xemitter.delegate(...P);
      }

      //=========================================================================================================

      //---------------------------------------------------------------------------------------------------------
      _socket_listen_on_all() {
        /* TAINT add arguments, timestamp */
        this._socket.on('close', function(...P) {
          return whisper('^intershop-rpc@4432-1^', 'socket:close'); // , ( rpr P )[ .. 100 ]
        });
        this._socket.on('connect', function(...P) {
          return whisper('^intershop-rpc@4432-2^', 'socket:connect'); // , ( rpr P )[ .. 100 ]
        });
        this._socket.on('data', function(...P) {
          return whisper('^intershop-rpc@4432-3^', 'socket:data'); // , ( rpr P )[ .. 100 ]
        });
        this._socket.on('drain', function(...P) {
          return whisper('^intershop-rpc@4432-4^', 'socket:drain'); // , ( rpr P )[ .. 100 ]
        });
        this._socket.on('end', function(...P) {
          return whisper('^intershop-rpc@4432-5^', 'socket:end'); // , ( rpr P )[ .. 100 ]
        });
        this._socket.on('error', function(...P) {
          return whisper('^intershop-rpc@4432-6^', 'socket:error'); // , ( rpr P )[ .. 100 ]
        });
        this._socket.on('lookup', function(...P) {
          return whisper('^intershop-rpc@4432-7^', 'socket:lookup'); // , ( rpr P )[ .. 100 ]
        });
        this._socket.on('timeout', function(...P) {
          return whisper('^intershop-rpc@4432-8^', 'socket:timeout'); // , ( rpr P )[ .. 100 ]
        });
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      _server_listen_on_all() {
        /* TAINT add arguments, timestamp */
        this._socketserver.on('close', function(...P) {
          return whisper('^intershop-rpc@4432-9^', 'socketserver:close'); // , ( rpr P )[ .. 100 ]
        });
        this._socketserver.on('connection', function(...P) {
          return whisper('^intershop-rpc@4432-10^', 'socketserver:connection'); // , ( rpr P )[ .. 100 ]
        });
        this._socketserver.on('error', function(...P) {
          return whisper('^intershop-rpc@4432-11^', 'socketserver:error'); // , ( rpr P )[ .. 100 ]
        });
        this._socketserver.on('listening', function(...P) {
          return whisper('^intershop-rpc@4432-12^', 'socketserver:listening'); // , ( rpr P )[ .. 100 ]
        });
        return null;
      }

    };

    Rpc.defaults = _defaults;

    return Rpc;

  }).call(this);

  //###########################################################################################################
  module.exports = Rpc;

  //###########################################################################################################
  if (module === require.main) {
    (() => {
      return null;
    })();
  }

}).call(this);

//# sourceMappingURL=main.js.map