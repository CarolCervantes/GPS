// Inicializa el cliente global de Supabase de forma resiliente (nunca bloquea ni crashea offline).
// Expone tanto la variable global `supabaseClient` como `window.supabaseClient`.
(function (root) {
  'use strict';

  function createQueryStub() {
    const emptyResult = Promise.resolve({ data: null, error: { message: 'Supabase offline' } });
    const builder = {
      select() { return builder; },
      insert() { return emptyResult; },
      update() { return builder; },
      upsert() { return emptyResult; },
      delete() { return builder; },
      eq() { return builder; },
      neq() { return builder; },
      gt() { return builder; },
      gte() { return builder; },
      lt() { return builder; },
      lte() { return builder; },
      in() { return builder; },
      order() { return builder; },
      limit() { return builder; },
      single() { return emptyResult; },
      maybeSingle() { return emptyResult; },
      then(resolve, reject) { return emptyResult.then(resolve, reject); },
      catch(reject) { return emptyResult.catch(reject); }
    };
    return builder;
  }

  function createChannelStub() {
    const ch = {
      __isOfflineChannelStub: true,
      topic: 'offline',
      state: 'closed',
      on() { return ch; },
      subscribe() { return ch; },
      send() { return Promise.resolve('offline'); },
      unsubscribe() { return Promise.resolve('ok'); },
      teardown() { return Promise.resolve('ok'); }
    };
    return ch;
  }

  function createOfflineStub() {
    return {
      __isOfflineStub: true,
      auth: {
        async getUser() { return { data: { user: null }, error: null }; },
        async getSession() { return { data: { session: null }, error: null }; },
        async signInWithPassword() { return { data: { user: null }, error: { message: 'offline' } }; },
        async signUp() { return { data: { user: null }, error: { message: 'offline' } }; },
        async signOut() { return { error: null }; },
        async resetPasswordForEmail() { return { data: null, error: null }; },
        async updateUser() { return { data: null, error: { message: 'offline' } }; }
      },
      from() { return createQueryStub(); },
      async rpc() { return { data: null, error: { message: 'offline' } }; },
      channel() { return createChannelStub(); },
      removeChannel() { return Promise.resolve('ok'); }
    };
  }

  function initSupabaseReal() {
    try {
      if (
        typeof root.supabase !== 'undefined' &&
        typeof root.supabase.createClient === 'function' &&
        root.SUPABASE_CONFIG &&
        root.SUPABASE_CONFIG.url &&
        root.SUPABASE_CONFIG.anonKey
      ) {
        const realClient = root.supabase.createClient(
          root.SUPABASE_CONFIG.url,
          root.SUPABASE_CONFIG.anonKey
        );
        if (typeof realClient.removeChannel === 'function') {
          const origRemove = realClient.removeChannel.bind(realClient);
          realClient.removeChannel = function (channel) {
            if (!channel || channel.__isOfflineChannelStub || typeof channel.teardown !== 'function') {
              return Promise.resolve('ok');
            }
            return origRemove(channel);
          };
        }
        root.supabaseClient = realClient;
        try { root.eval && (supabaseClient = realClient); } catch (_) {}
        return realClient;
      }
    } catch (_) {}

    if (!root.supabaseClient) {
      root.supabaseClient = createOfflineStub();
    }
    return root.supabaseClient;
  }

  root.initSupabaseReal = initSupabaseReal;
  initSupabaseReal();
})(typeof window !== 'undefined' ? window : globalThis);

var supabaseClient = window.supabaseClient;
