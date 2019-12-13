


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
@new_server = ( me ) ->
  R           = {}
  R.xemitter  = DATOM.new_xemitter()
  R.stop      = -> R.socketserver.close()
  #.........................................................................................................
  R.socketserver = NET.createServer ( socket ) =>
    R.socket          = socket
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
  return R

#-----------------------------------------------------------------------------------------------------------
@start = ( me ) -> new Promise ( resolve, reject ) =>
  #.........................................................................................................
  ### TAINT setting these as constants FTTB ###
  host = 'localhost'
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
      try event = JSON.parse line catch error
        @send_error me, """^rpc-secondary/$dispatch@5564^
          An error occurred while trying to parse #{rpr line}:
          #{error.message}"""
        break
      #.....................................................................................................
      switch type = type_of event
        # when 'list'
        #   warn "^rpc-secondary/$dispatch@5564^ using list instead of object in RPC calls is deprecated"
        #   [ method, parameters, ] = event
        #   $rsvp                   = true
        when 'object'
          { $key: method, $value: parameters, $rsvp, }  = event
          $rsvp                                        ?= false
        else
          @send_error me, "^rpc-secondary/$dispatch@5565^ expected object, got a #{type}: #{rpr event}"
          break
      #.....................................................................................................
      switch method
        when 'error'
          @send_error me, parameters
        #...................................................................................................
        when 'stop'
          process.send 'stop'
          process.exit()
        #...................................................................................................
        else
          if $rsvp is true
            @do_rpc me, method, parameters
      #.....................................................................................................
      break
    #.......................................................................................................
    ### TAINT sending on failed lines w/out marking them as such? ###
    send event ? line
    return null

#-----------------------------------------------------------------------------------------------------------
@do_rpc = ( me, method_name, parameters ) ->
  me.server.counts.rpcs  += +1
  method          = @[ "rpc_#{method_name}" ]
  method_type     = type_of method
  return @send_error me, "no such method: #{rpr method_name}" unless method?
  #.........................................................................................................
  try
    switch method_type
      when 'function'       then  result =        method.call @, parameters
      when 'asyncfunction'  then  result = await  method.call @, parameters
      else throw new Error "unknown method type #{rpr method_type}"
  catch error
    me.server.counts.errors += +1
    try
      { message, } = error
    catch error_2
      null
    message ?= '(UNKNOWN ERROR MESSAGE)'
    return @send_error me, error.message
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
  # debug '^intershop-rpc-server-secondary.coffee@3332^', ( rpr method_name ), ( rpr parameters )
  # if isa.object parameters  then  d = new_datom '^rpc-result', { $method, parameters..., }
  # else                            d = new_datom '^rpc-result', { $method, $value: parameters, }
  d = new_datom '^rpc-result', { $method, $value: parameters, }
  me.server.socket.write ( JSON.stringify d ) + '\n'
  return null


# #===========================================================================================================
# # RPC METHODS
# #-----------------------------------------------------------------------------------------------------------
# @rpc_has_rpc_method = ( S, P ) ->
#   ### TAINT don't do ad-hoc name mangling, use dedicated namespace ###
#   validate.nonempty_text P
#   return @[ "rpc_#{P}" ]?

# @rpc_echo_all_events = ( S ) ->
#   @_socket_listen_on_all socket
#   @_server_listen_on_all server

# #-----------------------------------------------------------------------------------------------------------
# @_socket_listen_on_all = ( socket ) ->
#   socket.on 'close',      -> whisper '^rpc-4432-1^', 'socket', 'close'
#   socket.on 'connect',    -> whisper '^rpc-4432-2^', 'socket', 'connect'
#   socket.on 'data',       -> whisper '^rpc-4432-3^', 'socket', 'data'
#   socket.on 'drain',      -> whisper '^rpc-4432-4^', 'socket', 'drain'
#   socket.on 'end',        -> whisper '^rpc-4432-5^', 'socket', 'end'
#   socket.on 'error',      -> whisper '^rpc-4432-6^', 'socket', 'error'
#   socket.on 'lookup',     -> whisper '^rpc-4432-7^', 'socket', 'lookup'
#   socket.on 'timeout',    -> whisper '^rpc-4432-8^', 'socket', 'timeout'
#   return null

# #-----------------------------------------------------------------------------------------------------------
# @_server_listen_on_all = ( server ) ->
#   server.on 'close',      -> whisper '^rpc-4432-9^', 'server', 'close'
#   server.on 'connection', -> whisper '^rpc-4432-10^', 'server', 'connection'
#   server.on 'error',      -> whisper '^rpc-4432-11^', 'server', 'error'
#   server.on 'listening',  -> whisper '^rpc-4432-12^', 'server', 'listening'
#   return null

# @rpc_echo_counts = ( n ) ->

# #-----------------------------------------------------------------------------------------------------------
# @rpc_helo = ( S, P ) ->
#   return "helo #{rpr P}"

# #-----------------------------------------------------------------------------------------------------------
# @rpc_add = ( S, P ) ->
#   unless ( CND.isa_list P ) and ( P.length is 2 )
#     throw new Error "expected a list with two numbers, got #{rpr P}"
#   [ a, b, ] = P
#   unless ( CND.isa_number a ) and ( CND.isa_number b )
#     throw new Error "expected a list with two numbers, got #{rpr P}"
#   return a + b



# ############################################################################################################
# if module is require.main then do =>
#   RPCS = @
#   RPCS.listen()


# # curl --silent --show-error localhost:23001/
# # curl --silent --show-error localhost:23001
# # curl --show-error localhost:23001
# # grep -r --color=always -P '23001' db src bin tex-inputs | sort | less -SRN
# # grep -r --color=always -P '23001' . | sort | less -SRN
# # grep -r --color=always -P '23001|8910|rpc' . | sort | less -SRN


