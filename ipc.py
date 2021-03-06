#!/usr/bin/python
# -*- coding: utf-8 -*-

"""

8888888 8888888b.   .d8888b.
  888   888   Y88b d88P  Y88b
  888   888    888 888    888
  888   888   d88P 888
  888   8888888P"  888
  888   888        888    888
  888   888        Y88b  d88P
8888888 888         "Y8888P"

"""

#-----------------------------------------------------------------------------------------------------------
import socket as _SOCKET
import os     as _OS
import json   as _JSON
_cache    = {}
settings  = {}

#-----------------------------------------------------------------------------------------------------------
def _prepare( ctx ):
  if _cache.get( 'SIGNALS.client_socket_rfile', None ) != None: return
  client_socket         = _SOCKET.socket( _SOCKET.AF_INET, _SOCKET.SOCK_STREAM )
  settings[ 'host' ]    = ctx.intershop_rpc_host
  settings[ 'port' ]    = int( ctx.intershop_rpc_port )
  settings[ 'address' ] = "{}:{}".format( settings[ 'host' ], settings[ 'port' ] )
  try:
    # ctx.log( "^intershop-rpc/_prepare@45598^ Trying to connect to: {}".format( settings[ 'address' ] ) )
    client_socket.connect( ( settings[ 'host' ], settings[ 'port' ], ) )
  except Exception as e:
    # ctx.log( "^intershop-rpc/_prepare@45598^ Error: {}".format( e ) )
    raise e
  client_socket_rfile                     = _OS.fdopen( client_socket.fileno(), 'r', encoding = 'utf-8' )
  _cache[ 'SIGNALS.client_socket'       ] = client_socket
  _cache[ 'SIGNALS.client_socket_rfile' ] = client_socket_rfile
  #.........................................................................................................
  def log( *messages ):
    _write_line( ctx, _JSON.dumps( { '$key': '^log', '$value': messages, } ) )
  #.........................................................................................................
  ctx.log = log
  ctx.log( "^2877^ added `ctx.log()`" )

#-----------------------------------------------------------------------------------------------------------
def _write_line( ctx, line ):
  _prepare( ctx )
  line_b = str.encode( line + '\n' )
  _cache[ 'SIGNALS.client_socket' ].send( line_b )

#-----------------------------------------------------------------------------------------------------------
def _read_line( ctx ):
  return _cache[ 'SIGNALS.client_socket_rfile' ].readline().strip()

#-----------------------------------------------------------------------------------------------------------
def server_is_online( ctx ):
  """Return `True` iff RPC server is reachable, `False` otherwise."""
  try:
    _prepare( ctx )
    _cache[ 'SIGNALS.client_socket' ].send( str.encode( '{"$key":"~ping","$value":null}\n' ) )
  except ConnectionRefusedError:
    return False
  return True

#-----------------------------------------------------------------------------------------------------------
def rpc( ctx, method, value, format = 'any' ):
  if format not in [ 'any', 'json' ]:
    raise KeyError( "^ipc.py/rpc@7771^ expected 'any' or 'json' for format, got " + repr( format ) )
  _write_line( ctx, _JSON.dumps( { '$key': method, '$value': value, '$rsvp': True, } ) )
  rsp       = _JSON.loads( _read_line( ctx ) )
  # ctx.log( '^777776^', repr( rsp ) )
  command   = rsp[ '$method' ]
  R         = rsp[ '$value' ]
  if command == 'error':
    # ctx.log( '^ipc.py/rpc@7776^', "when doing an RPC call to " + repr( method ) )
    # ctx.log( '^ipc.py/rpc@7776^', "with value " + repr( value ) )
    # ctx.log( '^ipc.py/rpc@7776^', "an error occurred: " )
    # ctx.log( rsp[ '$value' ] )
    raise RuntimeError( rsp[ '$value' ] )
  return _JSON.dumps( R ) if format == 'json' else R







