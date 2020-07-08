

/*

8888888 8888888b.   .d8888b.
  888   888   Y88b d88P  Y88b
  888   888    888 888    888
  888   888   d88P 888
  888   8888888P"  888
  888   888        888    888
  888   888        Y88b  d88P
8888888 888         "Y8888P"


A library to send signals to other processes, including facilities for RPC.

The important difference to PostgreSQL's NOTIFY / LISTEN facilities is that signals are sent immediately,
independently of transactions; this is vital when what you want to do is computing insert values during a
transaction.

*/

-- ---------------------------------------------------------------------------------------------------------
drop schema if exists IPC cascade;
create schema IPC;

-- ---------------------------------------------------------------------------------------------------------
set role dba;
create extension if not exists plpython3u with schema pg_catalog;
reset role;

-- current_database()
-- select current_setting('application_name');

-- ### TAINT consider to change name acc. to xemitter:
-- send() -> emit()
-- rpc()  -> delegate()
-- (to be used in RPC server): contract(), listen_to()

-- ---------------------------------------------------------------------------------------------------------
set role dba;
create function IPC.server_is_online() returns boolean volatile language plpython3u as $$
  plpy.execute( 'select U.py_init()' ); ctx = GD[ 'ctx' ]
  # ctx.log( '^22333^', "ctx.addons:", ctx.addons )
  # for key in ctx:
  #   ctx.log( '^22333^', "key:", key )
  # ctx.log( '^22333^', "ctx.intershop_rpc_host:", ctx.intershop_rpc_host )
  # ctx.log( '^22333^', "ctx.intershop_rpc_port:", ctx.intershop_rpc_port )
  # import sys
  # for path in sys.path:
  #   ctx.log( '^22333^', "path:", path )
  # # import ipc
  # # ctx.addons[ 'intershop-rpc' ] = ipc
  # # return ctx.addons[ 'intershop-rpc' ].server_is_online()
  return ctx.addons[ 'intershop-rpc' ].server_is_online( ctx )
  $$;

comment on function IPC.server_is_online() is 'Return `true` iff RPC server is reachable, `false`
otherwise.';

-- ---------------------------------------------------------------------------------------------------------
create function IPC.has_rpc_method( key text ) returns boolean volatile language plpython3u as $$
  plpy.execute( 'select U.py_init()' ); ctx = GD[ 'ctx' ]
  if not ctx.addons[ 'intershop-rpc' ].server_is_online( ctx ): return None
  try:
    return ctx.addons[ 'intershop-rpc' ].rpc( ctx, 'has_rpc_method', key )
  except ConnectionRefusedError as e:
    return False
  $$;

comment on function IPC.has_rpc_method( text ) is 'When RPC server is not online, always return `null`
(indicating no definite answer, but RPC not possible either way); otherwise, return whether method is found
on RPC server. Note that since methods can be added while the server is running, return values may be
subject to change at any time; also observe that there''s a race condition between testing for the server
being online, testing for the server having a given method, and actually calling that method, an RPC call
may still fail even if this method indicates it should succeed.';

-- ---------------------------------------------------------------------------------------------------------
create function IPC.get_server_address() returns text volatile language plpython3u as $$
  plpy.execute( 'select U.py_init()' ); ctx = GD[ 'ctx' ]
  return ctx.intershop_rpc_host + ':' + ctx.intershop_rpc_port
  $$;

comment on function IPC.get_server_address() is 'Get configured adress of the IPC server address.';

reset role;


-- ---------------------------------------------------------------------------------------------------------
set role dba;
create function IPC.send( key text, value jsonb ) returns void volatile language plpython3u as $$
  plpy.execute( 'select U.py_init()' ); ctx = GD[ 'ctx' ]
  import json
  ctx.addons[ 'intershop-rpc' ]._write_line( ctx, json.dumps( { '$key': key, '$value': json.loads( value ), } ) )
  $$;
reset role;


-- =========================================================================================================
-- RPC
-- ---------------------------------------------------------------------------------------------------------
set role dba;
create function IPC.rpc( key text, value jsonb ) returns jsonb volatile language plpython3u as $$
  plpy.execute( 'select U.py_init()' ); ctx = GD[ 'ctx' ]
  import json
  return ctx.addons[ 'intershop-rpc' ].rpc( ctx, key, json.loads( value ), format = 'json' )
  $$;
reset role;


-- =========================================================================================================
-- LOGGING
-- ---------------------------------------------------------------------------------------------------------
set role dba;
drop function if exists log( value variadic text[] );
reset role;
create function log( value variadic text[] ) returns void language sql as $$
  select IPC.send( '^log', to_jsonb( value ) ); $$




