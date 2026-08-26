-- Guest display names for anonymous auth users (Supabase is_anonymous).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    case
      when coalesce(new.is_anonymous, false) then
        'guest' || left(replace(new.id::text, '-', ''), 8)
      else
        coalesce(
          new.raw_user_meta_data->>'full_name',
          nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
          'guest' || left(replace(new.id::text, '-', ''), 8)
        )
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
