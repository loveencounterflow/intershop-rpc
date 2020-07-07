


'use strict'

############################################################################################################
CND                       = require 'cnd'
rpr                       = CND.rpr
badge                     = 'INTERSHOP-RPC'
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
  freeze
  select }                = DATOM.export()
#...........................................................................................................
@types                    = require './types'
{ isa
  validate
  cast
  type_of }               = @types
#...........................................................................................................
jr                        = JSON.stringify
Multimix                  = require 'multimix'
#...........................................................................................................
_defaults                 = freeze
  host:                     'localhost'
  port:                     23001
  show_counts:              true
  count_interval:           1000
  socket_log_all:           false
  socketserver_log_all:     false

#===========================================================================================================
#
#-----------------------------------------------------------------------------------------------------------
class Rpc extends Multimix
  @defaults = _defaults

  #=========================================================================================================
  #
  #---------------------------------------------------------------------------------------------------------
  constructor: ( settings ) ->
    super()
    ### TAINT validate.intershop_rpc_settings settings ###
    @settings         = { _defaults..., settings..., }
    @settings.address = "#{@settings.host}:#{@settings.port}"
    @settings         = freeze @settings
    @_xemitter        = DATOM.new_xemitter()
    @counts           = { requests: 0, rpcs: 0, hits: 0, fails: 0, errors: 0, }
    @_socketserver    = @_create_socketserver()
    #.......................................................................................................
    @_socket_listen_on_all() if @settings.socket_log_all
    @_server_listen_on_all() if @settings.socketserver_log_all
    #.......................................................................................................
    return @

  #---------------------------------------------------------------------------------------------------------
  @create: ( settings ) ->
    ### Convenience method to instantiate and start server ###
    R = new @ settings
    await R.start()
    return R

  #---------------------------------------------------------------------------------------------------------
  _create_socketserver: -> return NET.createServer ( socket ) =>
    @_socket          = socket
    socket.on 'data',   ( data  ) => source.send data unless data is ''
    socket.on 'error',  ( error ) => warn "socket error: #{error.message}"
    source            = SP.new_push_source()
    pipeline          = []
    #.....................................................................................................
    pipeline.push source
    # pipeline.push $watch ( d ) => urge '^3398^', rpr d.toString()
    pipeline.push SP.$split()
    pipeline.push @_$show_counts()
    pipeline.push @_$dispatch()
    pipeline.push $drain()
    #.....................................................................................................
    SP.pull pipeline...
    return null

  #---------------------------------------------------------------------------------------------------------
  start: -> new Promise ( resolve, reject ) =>
    process.on 'uncaughtException',  ( error ) => await @stop(); process.exitCode = 1; reject error
    process.on 'unhandledRejection', ( error ) => await @stop(); process.exitCode = 1; reject error
    @_socketserver.listen @settings.port, @settings.host, =>
      { address: host, port, family, } = @_socketserver.address()
      ### TAINT do in constructor? or add to settings? ###
      app_name = process.env[ 'intershop_db_name' ] ? 'intershop'
      help "RPC server for #{app_name} listening on #{family} #{host}:#{port}"
      resolve null
    #.......................................................................................................
    return null

  #---------------------------------------------------------------------------------------------------------
  stop: -> new Promise ( resolve, reject ) =>
    @_socketserver.close ( error ) =>
      return reject error if error?
      resolve null
    #.......................................................................................................
    return null


  #=========================================================================================================
  #
  #---------------------------------------------------------------------------------------------------------
  _$show_counts: -> $watch ( event ) =>
    @counts.requests += +1
    if @settings.show_counts and ( @counts.requests % @settings.count_interval ) is 0
      urge jr @counts
    return null

  #---------------------------------------------------------------------------------------------------------
  _$dispatch: ->
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
          @send_error """^rpc-secondary/$dispatch@1357^
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
            @send_error "^rpc-secondary/$dispatch@1359^ expected object, got a #{type}: #{rpr event}"
            break
        #.....................................................................................................
        switch method_name
          when 'error'
            @send_error parameters
          #...................................................................................................
          when 'stop'
            ### TAINT really exit process? ###
            process.exit()
          #...................................................................................................
          else
            if $rsvp is true
              ### TAINT `@do_rpc() is async ###
              @do_rpc method_name, parameters
        #.....................................................................................................
        break
      #.......................................................................................................
      ### TAINT sending on failed lines w/out marking them as such? ###
      send event ? line
      return null

  #---------------------------------------------------------------------------------------------------------
  do_rpc: ( method_name, parameters ) ->
    @counts.rpcs  += +1
    result = await @delegate method_name, parameters
    # help '^intershop-rpc/server/do_rpc@5567^', { result, }
    if isa.promise result
      result.then ( result ) => @_write method_name, result
    else
      @_write method_name, result
    return null

  #---------------------------------------------------------------------------------------------------------
  send_error: ( message ) ->
    @_write 'error', message

  #---------------------------------------------------------------------------------------------------------
  _write: ( $method, parameters ) ->
    # debug '^intershop-rpc-server-secondary.coffee@1362^', ( rpr method_name ), ( rpr parameters )
    # if isa.object parameters  then  d = new_datom '^rpc-result', { $method, parameters..., }
    # else                            d = new_datom '^rpc-result', { $method, $value: parameters, }
    d = new_datom '^rpc-result', { $method, $value: parameters, }
    @_socket.write ( jr d ) + '\n'
    return null


  #=========================================================================================================
  # XEMITTER METHODS
  #---------------------------------------------------------------------------------------------------------
  contract:           ( P... ) -> @_xemitter.contract           P...
  listen_to:          ( P... ) -> @_xemitter.listen_to          P...
  listen_to_all:      ( P... ) -> @_xemitter.listen_to_all      P...
  listen_to_unheard:  ( P... ) -> @_xemitter.listen_to_unheard  P...
  emit:               ( P... ) -> @_xemitter.emit               P...
  delegate:           ( P... ) -> @_xemitter.delegate           P...


  #=========================================================================================================
  #
  #---------------------------------------------------------------------------------------------------------
  _socket_listen_on_all: ->
    ### TAINT add arguments, timestamp ###
    @_socket.on 'close',   ( P... ) -> whisper '^intershop-rpc@4432-1^', 'socket:close'   # , ( rpr P )[ .. 100 ]
    @_socket.on 'connect', ( P... ) -> whisper '^intershop-rpc@4432-2^', 'socket:connect' # , ( rpr P )[ .. 100 ]
    @_socket.on 'data',    ( P... ) -> whisper '^intershop-rpc@4432-3^', 'socket:data'    # , ( rpr P )[ .. 100 ]
    @_socket.on 'drain',   ( P... ) -> whisper '^intershop-rpc@4432-4^', 'socket:drain'   # , ( rpr P )[ .. 100 ]
    @_socket.on 'end',     ( P... ) -> whisper '^intershop-rpc@4432-5^', 'socket:end'     # , ( rpr P )[ .. 100 ]
    @_socket.on 'error',   ( P... ) -> whisper '^intershop-rpc@4432-6^', 'socket:error'   # , ( rpr P )[ .. 100 ]
    @_socket.on 'lookup',  ( P... ) -> whisper '^intershop-rpc@4432-7^', 'socket:lookup'  # , ( rpr P )[ .. 100 ]
    @_socket.on 'timeout', ( P... ) -> whisper '^intershop-rpc@4432-8^', 'socket:timeout' # , ( rpr P )[ .. 100 ]
    return null

  #---------------------------------------------------------------------------------------------------------
  _server_listen_on_all: ->
    ### TAINT add arguments, timestamp ###
    @_socketserver.on 'close',      ( P... ) -> whisper '^intershop-rpc@4432-9^',  'socketserver:close'       # , ( rpr P )[ .. 100 ]
    @_socketserver.on 'connection', ( P... ) -> whisper '^intershop-rpc@4432-10^', 'socketserver:connection'  # , ( rpr P )[ .. 100 ]
    @_socketserver.on 'error',      ( P... ) -> whisper '^intershop-rpc@4432-11^', 'socketserver:error'       # , ( rpr P )[ .. 100 ]
    @_socketserver.on 'listening',  ( P... ) -> whisper '^intershop-rpc@4432-12^', 'socketserver:listening'   # , ( rpr P )[ .. 100 ]
    return null


############################################################################################################
module.exports = Rpc


############################################################################################################
if module is require.main then do =>
  null

