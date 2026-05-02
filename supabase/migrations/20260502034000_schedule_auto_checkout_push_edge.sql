begin;

create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault cascade;

do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (
      select 1
      from cron.job
      where jobname = 'auto-checkout-after-8pm-geofence'
    ) then
      perform cron.unschedule('auto-checkout-after-8pm-geofence');
    end if;

    if exists (
      select 1
      from cron.job
      where jobname = 'invoke-auto-checkout-push-edge'
    ) then
      perform cron.unschedule('invoke-auto-checkout-push-edge');
    end if;

    perform cron.schedule(
      'invoke-auto-checkout-push-edge',
      '*/15 * * * *',
      $job$
      select
        net.http_post(
          url := (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'project_url'
          ) || '/functions/v1/auto-checkout-push',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'anon_key'
            ),
            'x-auto-checkout-secret', (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'auto_checkout_edge_secret'
            )
          ),
          body := jsonb_build_object('scheduled_at', now())
        );
      $job$
    );
  end if;
exception
  when invalid_schema_name or undefined_function then
    raise notice 'pg_cron or pg_net is not available. Schedule auto-checkout-push from the Supabase Dashboard instead.';
end
$do$;

commit;
