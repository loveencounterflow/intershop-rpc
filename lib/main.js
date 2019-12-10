(function() {
  'use strict';
  var $, $async, $drain, $watch, CND, DATOM, MAIN, Multimix, NET, Rpc, SERVER, SP, alert, badge, cast, debug, echo, help, info, isa, jr, new_datom, rpr, select, type_of, urge, validate, warn, whisper;

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

  ({new_datom, select} = DATOM.export());

  //...........................................................................................................
  this.types = require('./types');

  ({isa, validate, cast, type_of} = this.types);

  //...........................................................................................................
  ({jr} = CND);

  Multimix = require('multimix');

  SERVER = require('./server');

  require('cnd/lib/exception-handler');

  //===========================================================================================================

  //-----------------------------------------------------------------------------------------------------------
  MAIN = this;

  Rpc = (function() {
    class Rpc extends Multimix {
      // @include ( require './outliner.mixin' ),    { overwrite: false, }
      // @extend MAIN, { overwrite: false, }

      //---------------------------------------------------------------------------------------------------------
      constructor(port) {
        super();
        this.port = port;
        this.server = SERVER.new_server(this);
        // @CFG    = require './cfg'
        // @export target if target?
        return this;
      }

      //---------------------------------------------------------------------------------------------------------
      async start() {
        await SERVER.listen(this);
        return null;
      }

      //---------------------------------------------------------------------------------------------------------
      contract(...P) {
        return this.server.xemitter.contract(...P);
      }

      listen_to(...P) {
        return this.server.xemitter.listen_to(...P);
      }

      listen_to_all(...P) {
        return this.server.xemitter.listen_to_all(...P);
      }

      listen_to_unheard(...P) {
        return this.server.xemitter.listen_to_unheard(...P);
      }

      emit(...P) {
        return this.server.xemitter.emit(...P);
      }

      delegate(...P) {
        return this.server.xemitter.delegate(...P);
      }

    };

    Rpc.include(MAIN, {
      overwrite: false
    });

    return Rpc;

  }).call(this);

  module.exports = Rpc;

  //###########################################################################################################
  if (module === require.main) {
    (() => {
      return null;
    })();
  }

}).call(this);
