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
  this.new_server = function(me) {
    var R;
    R = {};
    R.xemitter = DATOM.new_xemitter();
    R.stop = function() {
      return R.socketserver.close();
    };
    //.........................................................................................................
    R.socketserver = NET.createServer((socket) => {
      var pipeline, source;
      R.socket = socket;
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
    //.........................................................................................................
    return R;
  };

  //-----------------------------------------------------------------------------------------------------------
  this.start = function(me) {
    return new Promise((resolve, reject) => {
      var host;
      //.........................................................................................................
      /* TAINT setting these as constants FTTB */
      host = 'localhost';
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
      var $rsvp, error, event, method, parameters, type;
      if (line === '') {
        return null;
      }
      event = null;
      method = null;
      parameters = null;
      $rsvp = false;
      while (true) {
        try {
          //.......................................................................................................
          event = JSON.parse(line);
        } catch (error1) {
          error = error1;
          this.send_error(me, `^rpc-secondary/$dispatch@5564^\nAn error occurred while trying to parse ${rpr(line)}:\n${error.message}`);
          break;
        }
        //.....................................................................................................
        switch (type = type_of(event)) {
          // when 'list'
          //   warn "^rpc-secondary/$dispatch@5564^ using list instead of object in RPC calls is deprecated"
          //   [ method, parameters, ] = event
          //   $rsvp                   = true
          case 'object':
            ({
              $key: method,
              $value: parameters,
              $rsvp
            } = event);
            if ($rsvp == null) {
              $rsvp = false;
            }
            break;
          default:
            this.send_error(me, `^rpc-secondary/$dispatch@5565^ expected object, got a ${type}: ${rpr(event)}`);
            break;
        }
        //.....................................................................................................
        switch (method) {
          case 'error':
            this.send_error(me, parameters);
            break;
          //...................................................................................................
          case 'stop':
            process.send('stop');
            process.exit();
            break;
          default:
            //...................................................................................................
            if ($rsvp === true) {
              this.do_rpc(me, method, parameters);
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
    var error, error_2, message, method, method_type, result;
    me.server.counts.rpcs += +1;
    method = this[`rpc_${method_name}`];
    method_type = type_of(method);
    if (method == null) {
      return this.send_error(me, `no such method: ${rpr(method_name)}`);
    }
    try {
      //.........................................................................................................
      switch (method_type) {
        case 'function':
          result = method.call(this, parameters);
          break;
        case 'asyncfunction':
          result = (await method.call(this, parameters));
          break;
        default:
          throw new Error(`unknown method type ${rpr(method_type)}`);
      }
    } catch (error1) {
      error = error1;
      me.server.counts.errors += +1;
      try {
        ({message} = error);
      } catch (error1) {
        error_2 = error1;
        null;
      }
      if (message == null) {
        message = '(UNKNOWN ERROR MESSAGE)';
      }
      return this.send_error(me, error.message);
    }
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
    // debug '^intershop-rpc-server-secondary.coffee@3332^', ( rpr method_name ), ( rpr parameters )
    // if isa.object parameters  then  d = new_datom '^rpc-result', { $method, parameters..., }
    // else                            d = new_datom '^rpc-result', { $method, $value: parameters, }
    d = new_datom('^rpc-result', {
      $method,
      $value: parameters
    });
    me.server.socket.write((JSON.stringify(d)) + '\n');
    return null;
  };

  // #===========================================================================================================
// # RPC METHODS
// #-----------------------------------------------------------------------------------------------------------
// @rpc_has_rpc_method = ( S, P ) ->
//   ### TAINT don't do ad-hoc name mangling, use dedicated namespace ###
//   validate.nonempty_text P
//   return @[ "rpc_#{P}" ]?

// @rpc_echo_all_events = ( S ) ->
//   @_socket_listen_on_all socket
//   @_server_listen_on_all server

// #-----------------------------------------------------------------------------------------------------------
// @_socket_listen_on_all = ( socket ) ->
//   socket.on 'close',      -> whisper '^rpc-4432-1^', 'socket', 'close'
//   socket.on 'connect',    -> whisper '^rpc-4432-2^', 'socket', 'connect'
//   socket.on 'data',       -> whisper '^rpc-4432-3^', 'socket', 'data'
//   socket.on 'drain',      -> whisper '^rpc-4432-4^', 'socket', 'drain'
//   socket.on 'end',        -> whisper '^rpc-4432-5^', 'socket', 'end'
//   socket.on 'error',      -> whisper '^rpc-4432-6^', 'socket', 'error'
//   socket.on 'lookup',     -> whisper '^rpc-4432-7^', 'socket', 'lookup'
//   socket.on 'timeout',    -> whisper '^rpc-4432-8^', 'socket', 'timeout'
//   return null

// #-----------------------------------------------------------------------------------------------------------
// @_server_listen_on_all = ( server ) ->
//   server.on 'close',      -> whisper '^rpc-4432-9^', 'server', 'close'
//   server.on 'connection', -> whisper '^rpc-4432-10^', 'server', 'connection'
//   server.on 'error',      -> whisper '^rpc-4432-11^', 'server', 'error'
//   server.on 'listening',  -> whisper '^rpc-4432-12^', 'server', 'listening'
//   return null

// @rpc_echo_counts = ( n ) ->

// #-----------------------------------------------------------------------------------------------------------
// @rpc_helo = ( S, P ) ->
//   return "helo #{rpr P}"

// #-----------------------------------------------------------------------------------------------------------
// @rpc_add = ( S, P ) ->
//   unless ( CND.isa_list P ) and ( P.length is 2 )
//     throw new Error "expected a list with two numbers, got #{rpr P}"
//   [ a, b, ] = P
//   unless ( CND.isa_number a ) and ( CND.isa_number b )
//     throw new Error "expected a list with two numbers, got #{rpr P}"
//   return a + b

// ############################################################################################################
// if module is require.main then do =>
//   RPCS = @
//   RPCS.listen()

// # curl --silent --show-error localhost:23001/
// # curl --silent --show-error localhost:23001
// # curl --show-error localhost:23001
// # grep -r --color=always -P '23001' db src bin tex-inputs | sort | less -SRN
// # grep -r --color=always -P '23001' . | sort | less -SRN
// # grep -r --color=always -P '23001|8910|rpc' . | sort | less -SRN

}).call(this);
