-- Run once in a NEW Supabase project's SQL Editor.
-- Public stories and photo URLs are intentional. No email or password is collected.
begin;
create schema if not exists jar_private;
revoke all on schema jar_private from public, anon, authenticated;

create table public.memory_stars (
  id uuid primary key,
  owner_id uuid not null references auth.users(id),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  story text not null check (char_length(btrim(story)) between 10 and 3000),
  author text not null default '' check (char_length(author) <= 40),
  color text not null check (color in ('rose','lavender','sage','butter','blue')),
  image_path text unique,
  created_at timestamptz not null default now()
);
create index memory_stars_date on public.memory_stars(created_at desc, id desc);
create index memory_stars_owner on public.memory_stars(owner_id);
alter table public.memory_stars enable row level security;
revoke all on public.memory_stars from anon, authenticated;
grant select (id,title,story,author,color,image_path,created_at) on public.memory_stars to anon, authenticated;
create policy "Read shared memories" on public.memory_stars for select to anon, authenticated using (true);
-- No direct INSERT / UPDATE / DELETE grants: writes go through the functions below.

-- Keep a private submission history, without enforcing a publishing quota.
create table jar_private.submissions (owner_id uuid not null, submitted_at timestamptz not null default now());
create index submissions_owner on jar_private.submissions(owner_id, submitted_at);

create function public.create_memory_star(star_id uuid, star_title text, star_story text,
  star_author text, star_color text, star_image text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare visitor uuid := auth.uid(); existing_owner uuid;
begin
  if visitor is null then raise exception 'visitor_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(visitor::text, 0));
  select owner_id into existing_owner from public.memory_stars where id = star_id;
  if existing_owner = visitor then return star_id; end if; -- safe retry
  if existing_owner is not null then raise exception 'invalid_star_id'; end if;
  if star_image is not null then
    if star_image <> visitor::text || '/' || star_id::text || '.jpg'
       or not exists (select 1 from storage.objects where bucket_id = 'memory-photos' and name = star_image and owner_id = visitor::text)
    then raise exception 'invalid_photo'; end if;
  end if;
  insert into public.memory_stars(id,owner_id,title,story,author,color,image_path)
    values(star_id,visitor,btrim(star_title),btrim(star_story),btrim(coalesce(star_author,'')),star_color,star_image);
  insert into jar_private.submissions(owner_id) values(visitor);
  return star_id;
end $$;

create function public.owns_memory_star(star_id uuid) returns boolean
language sql security definer set search_path = '' stable as $$
  select exists(select 1 from public.memory_stars where id = star_id and owner_id = auth.uid());
$$;
create function public.delete_memory_star(star_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'visitor_required'; end if;
  delete from public.memory_stars where id = star_id and owner_id = auth.uid();
end $$;
revoke all on function public.create_memory_star(uuid,text,text,text,text,text) from public, anon;
revoke all on function public.owns_memory_star(uuid) from public, anon;
revoke all on function public.delete_memory_star(uuid) from public, anon;
grant execute on function public.create_memory_star(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.owns_memory_star(uuid) to authenticated;
grant execute on function public.delete_memory_star(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('memory-photos','memory-photos',true,5242880,array['image/jpeg']);

create function public.can_upload_memory_photo() returns boolean
language sql security definer set search_path = '' stable as $$
  select auth.uid() is not null;
$$;
revoke all on function public.can_upload_memory_photo() from public, anon;
grant execute on function public.can_upload_memory_photo() to authenticated;
create policy "Upload own memory photo" on storage.objects for insert to authenticated
with check (bucket_id = 'memory-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
  and public.can_upload_memory_photo());
create policy "Find own memory photos" on storage.objects for select to authenticated
using (bucket_id = 'memory-photos' and owner_id = (select auth.uid())::text);
create policy "Remove own memory photo" on storage.objects for delete to authenticated
using (bucket_id = 'memory-photos' and owner_id = (select auth.uid())::text);
commit;
