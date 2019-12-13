


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
  select }                = DATOM.export()
#...........................................................................................................
@types                    = require './types'
{ isa
  validate
  cast
  type_of }               = @types
#...........................................................................................................
{ jr }                    = CND
Multimix                  = require 'multimix'
SERVER                    = require './server'


#===========================================================================================================
#
#-----------------------------------------------------------------------------------------------------------
MAIN = @
class Rpc extends Multimix
  @include MAIN, { overwrite: false, }
  # @include ( require './outliner.mixin' ),    { overwrite: false, }
  # @extend MAIN, { overwrite: false, }

  #---------------------------------------------------------------------------------------------------------
  constructor: ( port ) ->
    super()
    @port   = port
    @server = SERVER.new_server @
    # @CFG    = require './cfg'
    # @export target if target?
    return @

  #---------------------------------------------------------------------------------------------------------
  start:  -> await SERVER.start @
  stop:   -> await SERVER.stop  @

  #---------------------------------------------------------------------------------------------------------
  contract:           ( P... ) -> @server.xemitter.contract           P...
  listen_to:          ( P... ) -> @server.xemitter.listen_to          P...
  listen_to_all:      ( P... ) -> @server.xemitter.listen_to_all      P...
  listen_to_unheard:  ( P... ) -> @server.xemitter.listen_to_unheard  P...
  emit:               ( P... ) -> @server.xemitter.emit               P...
  delegate:           ( P... ) -> @server.xemitter.delegate           P...

module.exports = Rpc


############################################################################################################
if module is require.main then do =>
  null

