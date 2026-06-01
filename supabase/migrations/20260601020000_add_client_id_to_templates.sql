begin;

alter table public.todo_templates add column if not exists client_id uuid null references public.clients(id) on delete cascade;

commit;
