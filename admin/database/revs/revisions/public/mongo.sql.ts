import {sql} from "kitres";


export const mongo = sql`
drop function if exists public.mongo;
create or replace function public.mongo( collection character varying, path character varying, content jsonb )
returns table (
  id text,
  object jsonb
)
language plpgsql as $$
declare
  origin character varying;
  _headers public.http_header[];
  _response_header record;
  _returns record;
  _parse record;
  url character varying;
begin
  origin := coalesce( current_setting( 'p2m.origin', true ), 'http://p2m.internal.srv:5000'::text );
  path := regexp_replace( path, '^/', '' );
  url := format( '%s/%s/%s/%s', origin, current_database(), mongo.collection, path );

  _headers := array[
--     public.http_header( 'x-flocoto.application.name', coalesce( current_setting( 'application.name', true ), 'flocoto'::text ) ),
  ]::public.http_header[];

  _headers := _headers || array [
--     public.http_header( 'x-flocoto.request.key', "auth".nanoid( 32 ) ),
  ]::public.http_header[];

  perform set_config('http.timeout_msec', '25000'::text, true );

  select
      response.headers as headers,
      response.status,
      response.content
    from public.http((
      'POST',
      url,
       _headers,
       'application/json', --content type
       content::text -- content data
    )) response
    into _returns;
  
  if _returns.status != 200 then
    raise exception '%', format( 'P2M returned status %s with content %s', _returns.status, _returns.content );
  end if;

  begin 
    select
        _returns.status,
        _returns.content::jsonb as content,
        ( _returns.content::jsonb->>'returns' ) as raw,
        ( _returns.content::jsonb->'returns' ) as returns,
        ( _returns.content::jsonb->>'message' ) as message,
        ( _returns.content::jsonb->'hint' ) as hint,
        ( _returns.content::jsonb->>'result' )::boolean as result
      into _parse ;
    
  exception when others then
    raise exception '%', format( 'Error ao efetuar o parse de resposta! O retorno veio no formato inesperado! Content %s', _returns.content );
  end;
  
  if not _parse.result then
    raise exception '%', format( 'P2M rejected request with message %s', _parse.message );
  end if;

  select jsonb_object_agg( h.field, h.value ) as headers
    from unnest( _returns.headers ) h
    into _response_header
  ;

  return query
    with __returns as (
      select
        e.docs->>'_id',
        e.docs
        from jsonb_array_elements( _parse.returns ) e ( docs )
    ) select * from __returns;
end;
$$;
`

export const mongo_inserts = sql`
drop function if exists public.mongo_inserts(collection character varying, item jsonb, items jsonb[] );
drop function if exists public.mongo_inserts;
create or replace function public.mongo_inserts( collection character varying, item jsonb, variadic items jsonb[] default '{}'::jsonb[] )
returns table (
  id text,
  object jsonb
)
language plpgsql as $$
declare
begin
  return query
    select *
      from public.mongo( $1, '/inserts', jsonb_build_object(
        'items', array[items] || items,
        'opts', coalesce( jsonb_build_object()) || jsonb_build_object(
          'returning', true
        )
      )
  );
end;
$$;
`;

export const mongo_updates = sql`
drop function if exists public.mongo_updates;
create or replace function public.mongo_updates( collection character varying, filter jsonb, sets jsonb, "returning" boolean default true, opts jsonb default null)
returns table (
  id text,
  object jsonb
)
language plpgsql as $$
declare
begin
  return query
    select *
      from public.mongo( collection, '/updates', jsonb_build_object(
        'sets', sets,
        'filter', filter,
        'opts', coalesce( opts, jsonb_build_object()) || jsonb_build_object(
          'returning', coalesce( "returning", (opts->>'returning')::boolean, true )
        )
       )
  );
end;
$$;
`;

export const mongo_upsert = sql`
drop function if exists public.mongo_updates;
create or replace function public.mongo_upsert( collection character varying, refs jsonb, sets jsonb, "returning" boolean default true, opts jsonb default null)
returns table (
  id text,
  object jsonb
)
language plpgsql as $$
declare
begin
  return query
    select *
      from public.mongo( collection, '/upsert', jsonb_build_object(
        'sets', sets,
        'refs', refs,
        'opts', coalesce( opts, jsonb_build_object()) || jsonb_build_object(
          'returning', coalesce( "returning", (opts->>'returning')::boolean, true )
        )
       )
  );
end;
$$;
`;

export const mongo_deletes = sql`
drop function if exists public.mongo_deletes;
create or replace function public.mongo_deletes( collection character varying, filter jsonb, "returning" boolean default true, opts jsonb default null)
returns table (
  id text,
  object jsonb
)
language plpgsql as $$
declare
begin
  return query
    select *
      from public.mongo( collection, '/deletes', jsonb_build_object(
        'filter', filter,
        'opts', coalesce( opts, jsonb_build_object()) || jsonb_build_object(
          'returning', coalesce( "returning", (opts->>'returning')::boolean, true )
        )
       )
    );
end;
$$;
`

export const mongo_finds = sql`
drop function if exists public.mongo_finds;
create or replace function public.mongo_finds( collection character varying, filter jsonb, opts jsonb default null)
returns table (
  id text,
  object jsonb
)
language plpgsql as $$
declare
begin
  return query
    select *
      from public.mongo( collection, '/finds', jsonb_build_object(
        'filter', filter,
        'opts', coalesce( opts, jsonb_build_object()) || jsonb_build_object()
       )
    );
end;
$$;
`








