-- 全球风电机组环境适应性评估平台 V2.9
-- 中央参数库：版本化、只保留一个 active 正式版本、服务端 RPC 原子发布。

create sequence if not exists public.config_version_seq start 1;

create table if not exists public.config_versions (
  id bigint generated always as identity primary key,
  version text not null unique,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'admin',
  description text not null default '',
  parameters jsonb not null,
  schema_version text not null default '2.9',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint config_parameters_object check (jsonb_typeof(parameters)='object')
);

create unique index if not exists ux_config_versions_one_active
  on public.config_versions ((is_active)) where is_active=true;
create index if not exists ix_config_versions_updated_at on public.config_versions(updated_at desc);

alter table public.config_versions enable row level security;
-- 浏览器不直接访问该表；只允许 Vercel Serverless 使用 Service Role Key。
-- 因此不创建 anon/authenticated 的 select/insert policy。

create or replace function public.publish_config(
  p_parameters jsonb,
  p_description text default '',
  p_updated_by text default 'admin',
  p_schema_version text default '2.9'
)
returns table(
  version text,
  updated_at timestamptz,
  updated_by text,
  description text,
  parameters jsonb,
  schema_version text,
  is_active boolean
)
language plpgsql
security definer
set search_path=public
as $$
declare
  n bigint;
  new_version text;
begin
  if jsonb_typeof(p_parameters) <> 'object' then
    raise exception 'parameters must be a JSON object';
  end if;
  perform pg_advisory_xact_lock(29001);
  n := nextval('public.config_version_seq');
  new_version := 'V2.9-P' || lpad(n::text,3,'0');
  update public.config_versions set is_active=false where is_active=true;
  insert into public.config_versions(version,updated_at,updated_by,description,parameters,schema_version,is_active)
  values(new_version,now(),coalesce(nullif(trim(p_updated_by),''),'admin'),left(coalesce(p_description,''),500),p_parameters,p_schema_version,true);
  return query
    select c.version,c.updated_at,c.updated_by,c.description,c.parameters,c.schema_version,c.is_active
    from public.config_versions c where c.version=new_version;
end;
$$;

revoke all on function public.publish_config(jsonb,text,text,text) from public;
grant execute on function public.publish_config(jsonb,text,text,text) to service_role;
