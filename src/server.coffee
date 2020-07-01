


'use strict'

############################################################################################################
CND                       = require 'cnd'
rpr                       = CND.rpr
badge                     = 'INTERSHOP-RPC/SERVER'
debug                     = CND.get_logger 'debug',     badge
alert                     = CND.get_logger 'alert',     badge
whisper                   = CND.get_logger 'whisper',   badge
warn                      = CND.get_logger 'warn',      badge
help                      = CND.get_logger 'help',      badge
urge                      = CND.get_logger 'urge',      badge
info                      = CND.get_logger 'info',      badge
echo                      = CND.echo.bind CND
#...........................................................................................................
# FS                        = require 'fs'
# PATH                      = require 'path'
NET                       = require 'net'
#...........................................................................................................
SP                        = require 'steampipes'
{ $
  $async
  $watch
  $drain }                = SP.export()
#...........................................................................................................
DATOM                     = require 'datom'
{ new_datom
  select }                = DATOM.export()
#...........................................................................................................
@types                    = require './types'
{ isa
  validate
  cast
  type_of }               = @types
#...........................................................................................................
{ jr }                    = CND


#-----------------------------------------------------------------------------------------------------------
@new_server = ( me, settings ) ->
  defaults    = { socket_log_all: false, socketserver_log_all: false, }
  settings    = { defaults..., settings..., }
  R           = {}
  R.xemitter  = DATOM.new_xemitter()
  R.stop      = -> R.socketserver.close()
  #.........................................................................................................
  R.socketserver = NET.createServer ( socket ) =>
    R.socket          = socket
    @_socket_listen_on_all socket if settings.socket_log_all
    R.counts          = { requests: 0, rpcs: 0, hits: 0, fails: 0, errors: 0, }
    R.show_counts     = false
    R.count_interval  = 1000
    socket.on 'data',   ( data  ) => source.send data unless data is ''
    socket.on 'error',  ( error ) => warn "socket error: #{error.message}"
    source            = SP.new_push_source()
    pipeline          = []
    #.......................................................................................................
    pipeline.push source
    pipeline.push SP.$split()
    # pipeline.push $watch ( d ) => urge '^3398^', jr d
    pipeline.push @$show_counts   me
    pipeline.push @$dispatch      me
    pipeline.push $drain()
    #.......................................................................................................
    SP.pull pipeline...
    return null
  #.........................................................................................................
  @_server_listen_on_all R.socketserver if settings.socketserver_log_all
  return R

#-----------------------------------------------------------------------------------------------------------
@start = ( me ) -> new Promise ( resolve, reject ) =>
  #.........................................................................................................
  process.on 'uncaughtException',  => await @stop me; process.exitCode = 1
  process.on 'unhandledRejection', => await @stop me; process.exitCode = 1
  ### TAINT setting these as constants FTTB ###
  # host = 'localhost'
  host = '127.0.0.1'
  me.server.socketserver.listen me.port, host, =>
    { address: host, port, family, } = me.server.socketserver.address()
    app_name = process.env[ 'intershop_db_name' ] ? 'intershop'
    help "RPC server for #{app_name} listening on #{family} #{host}:#{port}"
    resolve null
  return null

#-----------------------------------------------------------------------------------------------------------
@stop = ( me ) -> new Promise ( resolve, reject ) =>
  me.server.socketserver.close ( error ) =>
    return reject error if error?
    resolve null

#-----------------------------------------------------------------------------------------------------------
@$show_counts = ( me ) -> $watch ( event ) ->
  me.server.counts.requests += +1
  if me.server.show_counts and ( me.server.counts.requests % me.server.count_interval ) is 0
    urge JSON.stringify me.server.counts
  return null

#-----------------------------------------------------------------------------------------------------------
@$dispatch = ( me ) ->
  return $ ( line, send ) =>
    return null if line is ''
    event       = null
    method      = null
    parameters  = null
    $rsvp       = false
    #.......................................................................................................
    loop
      ### TAINt first parse format to be prepended, as in e.g. `json:{}` ###
      try event = JSON.parse line catch error
        @send_error me, """^rpc-secondary/$dispatch@1357^
          An error occurred while trying to parse #{rpr line}:
          #{error.message}"""
        break
      #.....................................................................................................
      switch type = type_of event
        when 'object'
          method_name = event.$key
          parameters  = event.$value
          $rsvp       = event.$rsvp ? false
        else
          @send_error me, "^rpc-secondary/$dispatch@1359^ expected object, got a #{type}: #{rpr event}"
          break
      #.....................................................................................................
      switch method_name
        when 'error'
          @send_error me, parameters
        #...................................................................................................
        when 'stop'
          ### TAINT really exit process? ###
          process.exit()
        #...................................................................................................
        else
          if $rsvp is true
            ### TAINT `@do_rpc() is async ###
            @do_rpc me, method_name, parameters
      #.....................................................................................................
      break
    #.......................................................................................................
    ### TAINT sending on failed lines w/out marking them as such? ###
    send event ? line
    return null

#-----------------------------------------------------------------------------------------------------------
@do_rpc = ( me, method_name, parameters ) ->
  me.server.counts.rpcs  += +1
  help '^intershop-rpc/server/do_rpc@5567^', result = await me.delegate method_name, parameters
  if isa.promise result
    result.then ( result ) => @_write me, method_name, result
  else
    @_write me, method_name, result
  return null

#-----------------------------------------------------------------------------------------------------------
@send_error = ( me, message ) ->
  @_write me, 'error', message

#-----------------------------------------------------------------------------------------------------------
@_write = ( me, $method, parameters ) ->
  # debug '^intershop-rpc-server-secondary.coffee@1362^', ( rpr method_name ), ( rpr parameters )
  # if isa.object parameters  then  d = new_datom '^rpc-result', { $method, parameters..., }
  # else                            d = new_datom '^rpc-result', { $method, $value: parameters, }
  d = new_datom '^rpc-result', { $method, $value: parameters, }
  me.server.socket.write ( JSON.stringify d ) + '\n'
  return null


#-----------------------------------------------------------------------------------------------------------
@_socket_listen_on_all = ( socket ) ->
  ### TAINT add arguments, timestamp ###
  socket.on 'close',      ( P... ) -> whisper '^intershop-rpc@4432-1^', 'socket:close'                    # , ( rpr P )[ .. 100 ]
  socket.on 'connect',    ( P... ) -> whisper '^intershop-rpc@4432-2^', 'socket:connect'                  # , ( rpr P )[ .. 100 ]
  socket.on 'data',       ( P... ) -> whisper '^intershop-rpc@4432-3^', 'socket:data'                     # , ( rpr P )[ .. 100 ]
  socket.on 'drain',      ( P... ) -> whisper '^intershop-rpc@4432-4^', 'socket:drain'                    # , ( rpr P )[ .. 100 ]
  socket.on 'end',        ( P... ) -> whisper '^intershop-rpc@4432-5^', 'socket:end'                      # , ( rpr P )[ .. 100 ]
  socket.on 'error',      ( P... ) -> whisper '^intershop-rpc@4432-6^', 'socket:error'                    # , ( rpr P )[ .. 100 ]
  socket.on 'lookup',     ( P... ) -> whisper '^intershop-rpc@4432-7^', 'socket:lookup'                   # , ( rpr P )[ .. 100 ]
  socket.on 'timeout',    ( P... ) -> whisper '^intershop-rpc@4432-8^', 'socket:timeout'                  # , ( rpr P )[ .. 100 ]
  return null

#-----------------------------------------------------------------------------------------------------------
@_server_listen_on_all = ( socketserver ) ->
  ### TAINT add arguments, timestamp ###
  socketserver.on 'close',      ( P... ) -> whisper '^intershop-rpc@4432-9^', 'socketserver:close'        # , ( rpr P )[ .. 100 ]
  socketserver.on 'connection', ( P... ) -> whisper '^intershop-rpc@4432-10^', 'socketserver:connection'  # , ( rpr P )[ .. 100 ]
  socketserver.on 'error',      ( P... ) -> whisper '^intershop-rpc@4432-11^', 'socketserver:error'       # , ( rpr P )[ .. 100 ]
  socketserver.on 'listening',  ( P... ) -> whisper '^intershop-rpc@4432-12^', 'socketserver:listening'   # , ( rpr P )[ .. 100 ]
  return null


