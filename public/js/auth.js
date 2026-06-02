let supabaseClient = null;
let currentUser = null;

export function initAuth(supabaseUrl, supabaseKey) {
  if (window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

    supabaseClient.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user || null;
      window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: currentUser } }));
    });
  }
}

export async function getCurrentUser() {
  if (!supabaseClient) return null;
  const { data: { user } } = await supabaseClient.auth.getUser();
  currentUser = user;
  return user;
}

export async function getAuthToken() {
  if (!supabaseClient) return null;
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session?.access_token || null;
}

export async function signUp(email, password) {
  if (!supabaseClient) throw new Error('Auth not initialized');
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  if (!supabaseClient) throw new Error('Auth not initialized');
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
}
