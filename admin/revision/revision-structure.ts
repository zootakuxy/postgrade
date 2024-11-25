import {sql, SQL} from "kitres";

export interface BaseStructureSqlOptions {
    schema:string,
}
export function revisionStructure( opts:BaseStructureSqlOptions){
    return sql`
-- BASE SQL UPGRADE STRUCTURE
create schema if not exists ${ SQL.identifier( opts.schema ) };
create table if not exists ${ SQL.identifier( opts.schema ) }.patch(
  patch_id serial,
  patch_identifier character varying not null,
  patch_source character varying not null,
  patch_unique boolean not null default false,
  patch_date timestamptz not null default clock_timestamp(),
  patch_applies int not null default 1,
  patch_apply timestamptz not null default clock_timestamp(),
  patch_flags text[] default array[]::text[],
  constraint pk_patch_id primary key ( patch_id )
);
alter table ${ SQL.identifier( opts.schema ) }.patch drop constraint if exists uk_patch_identifier;
alter table ${ SQL.identifier( opts.schema ) }.patch add constraint uk_patch_identifier unique ( patch_source, patch_identifier );

create table if not exists ${ SQL.identifier( opts.schema ) }.script(
  script_id serial not null,
  script_patch_id int not null,
  script_date timestamptz not null default clock_timestamp(),
  script_sql text not null,
  script_uses int not null default 1,
  script_apply timestamptz default clock_timestamp(),
  script_forcecode text[] default array[]::text[],
  script_versions text[] not null default array[]::text[],
  constraint pk_script_id primary key ( script_id ),
    constraint fk_script_to_path foreign key ( script_patch_id )
    references ${ SQL.identifier( opts.schema ) }.patch
);

create table if not exists ${ SQL.identifier( opts.schema ) }.version(
  version_id serial not null,
  version_code character varying,
  version_tag character varying,
  version_revision character varying,
  version_name character varying,
  version_GTAG character varying,
  version_TREV character varying,
  version_weight int4[] not null,
  version_revs int not null default 1,
  version_date timestamptz not null default clock_timestamp(),
  version_last timestamptz not null default clock_timestamp(),
  constraint pk_version_id primary key ( version_id )
);

create or replace function ${ SQL.identifier( opts.schema ) }.version( 
  args jsonb
) returns setof jsonb
  language plpgsql as $$
declare
  _version ${ SQL.identifier( opts.schema ) }.version; 
  _args ${ SQL.identifier( opts.schema ) }.version; 
begin
  _version := jsonb_populate_record( _version, args );
  _args := jsonb_populate_record( _args, args );
  select *
    from ${ SQL.identifier( opts.schema ) }.version v
    where v.version_code = _version.version_code
    into _version
  ;
  
  if _version.version_id is not null then 
    update ${ SQL.identifier( opts.schema ) }.version
      set
        version_revs = version_revs +1,
        version_tag = _args.version_tag,
        version_gtag = _args.version_gtag,
        version_last = clock_timestamp()
      where version_id = _version.version_id
      returning * into _version
    ;
  else
    _version := jsonb_populate_record( _version, args );
    insert into ${ SQL.identifier( opts.schema ) }.version(
      version_code,
      version_tag,
      version_revision,
      version_name,
      version_GTAG,
      version_TREV,
      version_weight
    ) values(
      _version.version_code,
      _version.version_tag,
      _version.version_revision,
      _version.version_name,
      _version.version_GTAG,
      _version.version_TREV,
      _version.version_weight
    ) returning * into _version;
  end if;
  
  return next to_jsonb( _version );
end;
$$;


create or replace function  ${ SQL.identifier( opts.schema ) }.posix(path character varying) returns character varying
    language sql as
$$
  select string_agg(t.part, '/') from regexp_split_to_table(path, '\\\\') t(part)
$$;



create or replace function ${ SQL.identifier( opts.schema ) }.check(
  args jsonb
) returns setof jsonb
language plpgsql as $$
declare
  /**
    args := {
      VERSION:
      patches: [{
        patch_identifier: IDENTIFIER,
        patch_source: SOURCE,
        patch_unique: BOOLEAN,
        script_force: FORCE_CODE,
        script_sql: SQL
        patch_flags: SQL
      }]
    }
   */
  patches jsonb default args->'patches';
  VERSION jsonb default args->'VERSION';
  _current_version ${ SQL.identifier( opts.schema ) }.version;
begin
  select *
    from ${ SQL.identifier( opts.schema ) }.version
    order by version_date desc, version_last desc, version_id desc
    limit 1
    into _current_version
  ;
  
  return next to_jsonb( _current_version );
  
  return query
    with  __script_rank as (
      select 
          s.*,
          rank() over ( partition by s.script_patch_id order by coalesce( s.script_apply, s.script_date ) desc, s.script_id desc ) as _script_rank 
        from ${ SQL.identifier( opts.schema ) }.script s  
    ), __current_script as (
      select *
        from __script_rank 
        where _script_rank = 1
    ), __script as (
      select
          e.doc->>'patch_identifier' as patch_identifier,
          ${ SQL.identifier( opts.schema ) }.posix( e.doc->>'patch_source' ) as patch_source,
          e.doc->>'patch_unique' as patch_unique,
          e.doc->>'script_force' as script_force,
          e.doc->>'script_sql' as script_sql
        from jsonb_array_elements( patches ) e  (doc )
    ), __patch_apply as (
      select _s.*,
          (p.patch_id is not null and s.script_id is not null and p.patch_unique ) or (
            p.patch_id is not null and s.script_id is not null
              and s.script_sql = _s.script_sql
              and (( _s.script_force is null and s.script_id is not null ) or _s.script_force = any ( s.script_forcecode ) )
          ) as exists
        from __script _s
          left join ${ SQL.identifier( opts.schema ) }.patch p on _s.patch_identifier = p.patch_identifier
            and ${ SQL.identifier( opts.schema ) }.posix( _s.patch_source ) = ${ SQL.identifier( opts.schema ) }.posix( p.patch_source )  
          left join __current_script s on p.patch_id = s.script_patch_id
    ), __filter as (
      select
          _pa.patch_identifier,
          _pa.patch_source,
          _pa.patch_unique,
          _pa.script_force,
          _pa.script_sql,
          count( * ) filter ( where _pa.exists ) as exists,
          count( * ) filter ( where _pa.exists ) = 0 as apply
        from __patch_apply _pa
        group by
          _pa.patch_identifier,
          _pa.patch_source,
          _pa.patch_unique,
          _pa.script_force,
          _pa.script_sql
    ) select to_jsonb( _f )
        from __filter _f
        where _f.apply
  ;
end;
$$;


create or replace function ${ SQL.identifier( opts.schema ) }.apply(
  args jsonb
) returns setof jsonb
language plpgsql as $$
declare
  /**
    args := {
      VERSION: VERSION
      patch_identifier: IDENTIFIER,
      patch_source: SOURCE,
      patch_unique: BOOLEAN,
      script_force: FORCE_CODE,
      script_sql: SQL
      patch_flags: SQL
    }
   */
  VERSION text default args->'VERSION';
  _patch_flags text[] default  array( select jsonb_array_elements_text( args->'patch_flags' ));
  _patch_identifier text default args->>'patch_identifier';
  _patch_source text default args->>'patch_source';
  _patch_unique bool default args->>'patch_unique';
  _script_force text default args->>'script_force';
  _script_forcecode text[] default array[]::text[];
  _script_sql text default   args->>'script_sql';
  _data record;
  _patch ${ SQL.identifier( opts.schema ) }.patch;
  _script ${ SQL.identifier( opts.schema ) }.script;
  _apply timestamptz default clock_timestamp();
begin
  select *
    from ${ SQL.identifier( opts.schema ) }.patch p
      left join ${ SQL.identifier( opts.schema ) }.script s on p.patch_id = s.script_patch_id
        and s.script_sql = _script_sql
    where p.patch_identifier = _patch_identifier
      and ${ SQL.identifier( opts.schema ) }.posix( p.patch_source ) = ${ SQL.identifier( opts.schema ) }.posix( _patch_source ) 
    order by s.script_date desc, s.script_id desc
    into _data
  ;

  if _data.patch_id is null then
    insert into ${ SQL.identifier( opts.schema ) }.patch (
      patch_identifier,
      patch_source,
      patch_unique,
      patch_flags,
      patch_apply
    ) values (
      _patch_identifier,
      ${ SQL.identifier( opts.schema ) }.posix( _patch_source ),
      _patch_unique,
      _patch_flags,
      _apply
    ) returning * into _patch;
  else
    update ${ SQL.identifier( opts.schema ) }.patch
      set patch_applies = patch_applies +1,
          patch_apply = _apply,
          patch_unique = case
            when _patch_unique then _patch_unique
            else patch_unique
          end
      where patch_id = _data.patch_id
      returning * into _patch
    ;
  end if;

  if _script_force is not null  then
    _script_forcecode := _script_forcecode || _script_force;
  end if;


  if _data.script_id is null then
    insert into ${ SQL.identifier( opts.schema ) }.script (
      script_patch_id,
      script_sql,
      script_forcecode,
      script_versions,
      script_apply
    ) values (
      _patch.patch_id,
      _script_sql,
      _script_forcecode,
      array[ VERSION ]::text[],
      _apply
    ) returning * into _script;
  else
    update ${ SQL.identifier( opts.schema ) }.script
      set script_uses = script_uses +1,
          script_apply = _apply,
          script_versions = script_versions || VERSION,
          script_forcecode = script_forcecode || _script_forcecode
      where script_id = _data.script_id
    ;

  end if;

  return next to_jsonb(_patch)||to_jsonb(_script);
end;
$$;

create or replace function ${ SQL.identifier( opts.schema ) }.notify( message text )
returns void
language plpgsql as $$
begin
    raise notice '%', message;
end;
$$;

drop view if exists ${ SQL.identifier( opts.schema ) }.vscript;
create view ${ SQL.identifier( opts.schema ) }.vscript as
    select *
    from ${ SQL.identifier( opts.schema ) }.patch p
      inner join ${ SQL.identifier( opts.schema ) }.script s on p.patch_id = s.script_patch_id
;


`
}

