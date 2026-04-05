import { supabase, isSupabaseEnabled } from './supabaseClient.js';

const AUTH_DB_KEY = 'fd-auth-db';
const AUTH_SESSION_KEY = 'fd-auth-session';

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

async function resolveAuthenticatedUserId(fallbackId = null) {
  if (isUuid(fallbackId)) return String(fallbackId).trim();

  const { data, error } = await supabase.auth.getUser();
  const userId = data?.user?.id;
  if (error || !isUuid(userId)) {
    throw new Error('Nao foi possivel identificar o usuario autenticado.');
  }
  return userId;
}

function generateFamilyCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function normalizeFamilyCodeInput(code) {
  return String(code || '').trim().toUpperCase();
}

function readDb() {
  const raw = localStorage.getItem(AUTH_DB_KEY);
  if (!raw) {
    const initial = { users: [], families: [] };
    localStorage.setItem(AUTH_DB_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed?.users) ? parsed.users : [],
      families: Array.isArray(parsed?.families) ? parsed.families : [],
    };
  } catch {
    return { users: [], families: [] };
  }
}

function writeDb(db) {
  localStorage.setItem(AUTH_DB_KEY, JSON.stringify(db));
}

function readSession() {
  const raw = localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.userId ? parsed : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  if (!session) {
    localStorage.removeItem(AUTH_SESSION_KEY);
    return;
  }
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function dispatchAuthChanged() {
  window.dispatchEvent(new CustomEvent('auth:changed'));
}

function mergeFamilyMembers(db, familyId, members, dependents) {
  const otherUsers = db.users.filter((u) => u.familyId !== familyId);
  db.users = [...otherUsers, ...members];

  const restFamilies = db.families.filter((f) => f.id !== familyId);
  const existing = db.families.find((f) => f.id === familyId);
  db.families = [
    ...restFamilies,
    {
      id: familyId,
      name: existing?.name || 'Familia',
      code: existing?.code || '',
      ownerId: existing?.ownerId || null,
      createdAt: existing?.createdAt || new Date().toISOString(),
      dependents,
    },
  ];
}

async function fetchRemoteProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, photo_url, family_id, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchRemoteFamily(familyId) {
  const { data, error } = await supabase
    .from('families')
    .select('id, name, code, owner_id, created_at')
    .eq('id', familyId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchRemoteFamilyMembers(familyId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, photo_url, family_id, created_at')
    .eq('family_id', familyId);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function fetchRemoteDependents(familyId) {
  const { data, error } = await supabase
    .from('dependents')
    .select('id, family_id, name, birth_date, photo_url, role, created_at')
    .eq('family_id', familyId);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function toLocalUser(profile) {
  return {
    id: profile.id,
    name: profile.name,
    email: normalizeEmail(profile.email),
    familyId: profile.family_id || null,
    photoUrl: profile.photo_url || null,
    createdAt: profile.created_at || new Date().toISOString(),
  };
}

function toLocalFamily(family, dependents) {
  if (!family) return null;
  return {
    id: family.id,
    name: family.name,
    code: family.code,
    ownerId: family.owner_id,
    createdAt: family.created_at,
    dependents: dependents.map((d) => ({
      id: d.id,
      name: d.name,
      photoUrl: d.photo_url || null,
      role: d.role || 'filho',
      birthDate: d.birth_date || null,
      createdAt: d.created_at,
    })),
  };
}

function deriveUserNameFromEmail(email) {
  const localPart = String(email || '').split('@')[0] || '';
  return localPart.trim() || 'Usuario';
}

async function ensureRemoteProfile(userId) {
  let profile = await fetchRemoteProfile(userId);
  if (profile?.name && String(profile.name).trim()) {
    return profile;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user?.id) {
    throw authError || new Error('Nao foi possivel identificar o usuario autenticado.');
  }

  const authUser = authData.user;
  const safeEmail = normalizeEmail(authUser.email || profile?.email || '');
  const safeName = String(
    profile?.name
    || authUser.user_metadata?.name
    || authUser.user_metadata?.full_name
    || deriveUserNameFromEmail(safeEmail),
  ).trim();

  const { error: upsertError } = await supabase.from('profiles').upsert({
    id: userId,
    name: safeName || 'Usuario',
    email: safeEmail,
  });

  if (upsertError) {
    throw upsertError;
  }

  profile = await fetchRemoteProfile(userId);
  return profile;
}

async function syncUserFromRemote(userId) {
  if (!isSupabaseEnabled()) return;
  const profile = await ensureRemoteProfile(userId);
  if (!profile) return;

  const db = readDb();
  const localUser = toLocalUser(profile);

  db.users = [...db.users.filter((u) => u.id !== localUser.id), localUser];

  if (localUser.familyId) {
    const [family, profiles, dependents] = await Promise.all([
      fetchRemoteFamily(localUser.familyId),
      fetchRemoteFamilyMembers(localUser.familyId),
      fetchRemoteDependents(localUser.familyId),
    ]);

    const familyMembers = profiles.map(toLocalUser);
    const localFamily = toLocalFamily(family, dependents);

    mergeFamilyMembers(db, localUser.familyId, familyMembers, localFamily?.dependents || []);

    if (localFamily) {
      db.families = [...db.families.filter((f) => f.id !== localFamily.id), localFamily];
    }
  }

  writeDb(db);
}

function ensureSupabaseConfigured() {
  if (!isSupabaseEnabled()) {
    throw new Error('Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }
}

function buildPasswordRecoveryRedirect() {
  const configuredUrl = String(import.meta.env.VITE_APP_URL || '').trim();
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const baseUrl = configuredUrl || (isLocalhost ? 'https://kair-s-virid.vercel.app' : window.location.origin);
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function isAuthenticated() {
  return Boolean(readSession()?.userId);
}

export function getCurrentUser() {
  const session = readSession();
  if (!session?.userId) return null;
  const db = readDb();
  return db.users.find((u) => u.id === session.userId) || null;
}

export function getCurrentFamily() {
  const user = getCurrentUser();
  if (!user?.familyId) return null;
  const db = readDb();
  return db.families.find((f) => f.id === user.familyId) || null;
}

export function getFamilyMembers() {
  const user = getCurrentUser();
  if (!user) return [];
  if (!user.familyId) return [user];
  const db = readDb();
  const familyUsers = db.users.filter((u) => u.familyId === user.familyId);
  const family = db.families.find((f) => f.id === user.familyId);
  const dependents = Array.isArray(family?.dependents) ? family.dependents : [];

  const dependentMembers = dependents.map((d) => ({
    id: d.id,
    name: d.name,
    photoUrl: d.photoUrl || null,
    familyId: user.familyId,
    isDependent: true,
    role: d.role || 'dependente',
    birthDate: d.birthDate || null,
    createdAt: d.createdAt,
  }));

  return [...familyUsers, ...dependentMembers];
}

export async function registerUser({ name, email, password }) {
  ensureSupabaseConfigured();

  const safeName = String(name || '').trim();
  const safeEmail = normalizeEmail(email);
  const safePassword = String(password || '').trim();

  if (!safeName || !safeEmail || !safePassword) {
    throw new Error('Preencha nome, email e senha.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: safeEmail,
    password: safePassword,
  });

  if (error) {
    throw new Error(error.message || 'Falha no cadastro.');
  }

  const userId = data?.user?.id;
  if (!userId) {
    throw new Error('Cadastro criado. Verifique seu email para confirmar a conta e depois faca login.');
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    name: safeName,
    email: safeEmail,
    family_id: null,
  });

  if (profileError) {
    throw new Error(profileError.message || 'Falha ao criar perfil do usuario.');
  }

  writeSession({ userId, loggedAt: new Date().toISOString() });
  await syncUserFromRemote(userId);
  dispatchAuthChanged();

  return getCurrentUser();
}

export async function loginUser(email, password) {
  ensureSupabaseConfigured();

  const safeEmail = normalizeEmail(email);
  const safePassword = String(password || '').trim();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: safeEmail,
    password: safePassword,
  });

  if (error || !data?.user?.id) {
    throw new Error('Email ou senha invalidos.');
  }

  const userId = data.user.id;
  writeSession({ userId, loggedAt: new Date().toISOString() });

  await syncUserFromRemote(userId);
  dispatchAuthChanged();
  return getCurrentUser();
}

export async function requestPasswordReset(email) {
  ensureSupabaseConfigured();

  const safeEmail = normalizeEmail(email);
  if (!safeEmail) {
    throw new Error('Informe seu email para recuperar a senha.');
  }

  const { error } = await supabase.auth.resetPasswordForEmail(safeEmail, {
    redirectTo: buildPasswordRecoveryRedirect(),
  });

  if (error) {
    throw new Error(error.message || 'Nao foi possivel enviar o email de recuperacao.');
  }
}

export async function preparePasswordRecoverySession() {
  ensureSupabaseConfigured();

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  if (searchParams.has('code')) {
    const code = String(searchParams.get('code') || '').trim();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw new Error(error.message || 'Link de recuperacao invalido ou expirado.');
    }
    return;
  }

  if (hashParams.has('access_token') && hashParams.has('refresh_token')) {
    const { error } = await supabase.auth.setSession({
      access_token: String(hashParams.get('access_token') || ''),
      refresh_token: String(hashParams.get('refresh_token') || ''),
    });
    if (error) {
      throw new Error(error.message || 'Nao foi possivel validar o link de recuperacao.');
    }
    return;
  }

  if (searchParams.get('type') === 'recovery' && searchParams.has('token_hash')) {
    const { error } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: String(searchParams.get('token_hash') || ''),
    });
    if (error) {
      throw new Error(error.message || 'Link de recuperacao invalido ou expirado.');
    }
  }
}

export async function completePasswordRecovery(newPassword) {
  ensureSupabaseConfigured();

  const safePassword = String(newPassword || '').trim();
  if (safePassword.length < 6) {
    throw new Error('A senha deve ter pelo menos 6 caracteres.');
  }

  const { error } = await supabase.auth.updateUser({ password: safePassword });
  if (error) {
    throw new Error(error.message || 'Nao foi possivel redefinir a senha.');
  }

  await supabase.auth.signOut();
  writeSession(null);
  dispatchAuthChanged();

  const cleanUrl = `${window.location.origin}${window.location.pathname}#login`;
  window.history.replaceState({}, document.title, cleanUrl);
}

export async function logoutUser() {
  if (isSupabaseEnabled()) {
    await supabase.auth.signOut();
  }
  writeSession(null);
  dispatchAuthChanged();
}

export async function updateUserPassword(newPassword) {
  ensureSupabaseConfigured();

  const current = getCurrentUser();
  if (!current) throw new Error('Faca login para alterar a senha.');

  const safePassword = String(newPassword || '').trim();
  if (safePassword.length < 4) {
    throw new Error('A senha deve ter pelo menos 4 caracteres.');
  }

  const { error } = await supabase.auth.updateUser({ password: safePassword });
  if (error) throw new Error(error.message || 'Nao foi possivel atualizar a senha.');

  dispatchAuthChanged();
}

export async function updateUserProfile({ name, photoUrl }) {
  ensureSupabaseConfigured();

  const current = getCurrentUser();
  const currentId = current?.id;

  let userId = currentId;
  if (!userId) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user?.id) {
      throw new Error('Faca login para alterar o perfil.');
    }
    userId = authData.user.id;
  }

  const safeName = name !== undefined ? String(name || '').trim() : current?.name;
  const safePhotoUrl = photoUrl !== undefined ? String(photoUrl || '').trim() : current?.photoUrl;

  if (!safeName) {
    throw new Error('Informe o nome para salvar o perfil.');
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user?.email) {
    throw new Error('Nao foi possivel identificar seu email para salvar o perfil.');
  }
  const safeEmail = normalizeEmail(authData.user.email);

  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    name: safeName,
    email: safeEmail,
    photo_url: safePhotoUrl || null,
  });

  if (error) throw new Error(error.message || 'Nao foi possivel atualizar o perfil.');

  await syncUserFromRemote(userId);
  dispatchAuthChanged();
}

export async function createFamily(name) {
  ensureSupabaseConfigured();

  const current = getCurrentUser();
  if (!current) {
    throw new Error('Faca login para criar uma familia.');
  }

  const safeName = String(name || '').trim();
  if (!safeName) {
    throw new Error('Informe o nome da familia.');
  }

  if (current.familyId) {
    return getCurrentFamily();
  }

  let familyCode = generateFamilyCode();
  let insertedFamily = null;

  for (let i = 0; i < 5; i += 1) {
    const { data, error } = await supabase
      .from('families')
      .insert({
        name: safeName,
        code: familyCode,
        owner_id: current.id,
      })
      .select('id, name, code, owner_id, created_at')
      .single();

    if (!error && data) {
      insertedFamily = data;
      break;
    }

    familyCode = generateFamilyCode();
  }

  if (!insertedFamily) {
    throw new Error('Nao foi possivel criar a familia agora. Tente novamente.');
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ family_id: insertedFamily.id })
    .eq('id', current.id);

  if (updateError) {
    throw new Error(updateError.message || 'Falha ao vincular usuario na familia.');
  }

  await syncUserFromRemote(current.id);
  dispatchAuthChanged();
  return getCurrentFamily();
}

export async function leaveFamilyAsync() {
  ensureSupabaseConfigured();

  const current = getCurrentUser();
  if (!current) {
    throw new Error('Faca login para sair de uma familia.');
  }

  if (!current.familyId) {
    throw new Error('Voce nao esta em uma familia.');
  }

  const userId = await resolveAuthenticatedUserId(current.id);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ family_id: null })
    .eq('id', userId);

  if (updateError) {
    throw new Error(updateError.message || 'Falha ao sair da familia.');
  }

  await syncUserFromRemote(userId);
  dispatchAuthChanged();
  return null;
}

export async function joinFamilyByCode(code) {
  ensureSupabaseConfigured();

  const current = getCurrentUser();
  if (!current) {
    throw new Error('Faca login para entrar em uma familia.');
  }

  await ensureRemoteProfile(current.id);

  const safeCode = normalizeFamilyCodeInput(code);
  if (!safeCode) throw new Error('Informe o codigo da familia.');

  const { error } = await supabase.rpc('join_family_by_code', {
    input_code: safeCode,
  });

  if (error) {
    throw new Error(error.message || 'Nao foi possivel entrar na familia.');
  }

  await syncUserFromRemote(current.id);
  dispatchAuthChanged();
  return getCurrentFamily();
}

export async function findFamilyByCode(code) {
  ensureSupabaseConfigured();

  const current = getCurrentUser();
  if (!current) {
    throw new Error('Faca login para buscar uma familia.');
  }

  const safeCode = normalizeFamilyCodeInput(code);
  if (!safeCode) throw new Error('Informe o codigo da familia.');

  const { data, error } = await supabase.rpc('find_family_by_code', {
    input_code: safeCode,
  });

  if (error) {
    throw new Error(error.message || 'Nao foi possivel buscar a familia.');
  }

  return data || null;
}

export async function searchFamiliesByName(nameQuery) {
  ensureSupabaseConfigured();

  const current = getCurrentUser();
  if (!current) {
    throw new Error('Faca login para buscar familias.');
  }

  const safeQuery = String(nameQuery || '').trim();
  if (!safeQuery) return [];

  const { data, error } = await supabase.rpc('search_families_by_name', {
    input_name: safeQuery,
  });

  if (error) {
    throw new Error(error.message || 'Nao foi possivel buscar familias.');
  }

  return Array.isArray(data) ? data : [];
}

export async function requestFamilyJoinByCode(code) {
  ensureSupabaseConfigured();

  const current = getCurrentUser();
  if (!current) {
    throw new Error('Faca login para solicitar entrada em uma familia.');
  }

  const safeCode = normalizeFamilyCodeInput(code);
  if (!safeCode) throw new Error('Informe o codigo da familia.');

  await ensureRemoteProfile(current.id);

  const { data, error } = await supabase.rpc('request_family_join_by_code', {
    input_code: safeCode,
  });

  if (error) {
    throw new Error(error.message || 'Nao foi possivel solicitar entrada na familia.');
  }

  return data || null;
}

export async function listPendingFamilyJoinRequests() {
  ensureSupabaseConfigured();

  const current = getCurrentUser();
  if (!current) {
    throw new Error('Faca login para ver solicitacoes.');
  }

  const { data, error } = await supabase.rpc('list_pending_family_join_requests');
  if (error) {
    throw new Error(error.message || 'Nao foi possivel carregar solicitacoes pendentes.');
  }

  return Array.isArray(data) ? data : [];
}

export async function reviewFamilyJoinRequest(requestId, decision) {
  ensureSupabaseConfigured();

  const current = getCurrentUser();
  if (!current) {
    throw new Error('Faca login para revisar solicitacoes.');
  }

  const safeRequestId = String(requestId || '').trim();
  const safeDecision = String(decision || '').trim().toLowerCase();
  if (!safeRequestId) throw new Error('Solicitacao invalida.');
  if (!['approved', 'rejected'].includes(safeDecision)) throw new Error('Decisao invalida.');

  const { data, error } = await supabase.rpc('review_family_join_request', {
    request_id: safeRequestId,
    decision: safeDecision,
  });

  if (error) {
    throw new Error(error.message || 'Nao foi possivel revisar a solicitacao.');
  }

  return data || null;
}

export async function addDependentChild({ name, birthDate = '', photoUrl = '' }) {
  ensureSupabaseConfigured();

  const current = getCurrentUser();
  if (!current) {
    throw new Error('Faca login para adicionar dependentes.');
  }
  if (!current.familyId) {
    throw new Error('Crie ou entre em uma familia primeiro.');
  }

  const safeName = String(name || '').trim();
  if (!safeName) {
    throw new Error('Informe o nome da crianca.');
  }

  const safeBirthDate = String(birthDate || '').trim();
  const safePhotoUrl = String(photoUrl || '').trim();

  const { data: existing, error: checkError } = await supabase
    .from('dependents')
    .select('id')
    .eq('family_id', current.familyId)
    .ilike('name', safeName)
    .limit(1);

  if (checkError) throw new Error(checkError.message || 'Falha ao validar dependente.');
  if (Array.isArray(existing) && existing.length > 0) {
    throw new Error('Ja existe um dependente com esse nome na familia.');
  }

  const { error } = await supabase.from('dependents').insert({
    family_id: current.familyId,
    name: safeName,
    role: 'filho',
    birth_date: safeBirthDate || null,
    photo_url: safePhotoUrl || null,
    created_by: current.id,
  });

  if (error) throw new Error(error.message || 'Nao foi possivel adicionar o filho.');

  await syncUserFromRemote(current.id);
  dispatchAuthChanged();
}

export async function updateDependentChild({ dependentId, name, birthDate = '', photoUrl = '' }) {
  ensureSupabaseConfigured();

  const current = getCurrentUser();
  if (!current) {
    throw new Error('Faca login para editar dependentes.');
  }
  if (!current.familyId) {
    throw new Error('Voce precisa estar em uma familia.');
  }

  const safeDependentId = String(dependentId || '').trim();
  const safeName = String(name || '').trim();
  const safeBirthDate = String(birthDate || '').trim();
  const safePhotoUrl = String(photoUrl || '').trim();

  if (!safeDependentId) throw new Error('Dependente invalido.');
  if (!safeName) throw new Error('Informe o nome da crianca.');

  const { error } = await supabase
    .from('dependents')
    .update({
      name: safeName,
      birth_date: safeBirthDate || null,
      photo_url: safePhotoUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', safeDependentId)
    .eq('family_id', current.familyId);

  if (error) throw new Error(error.message || 'Nao foi possivel atualizar o filho.');

  await syncUserFromRemote(current.id);
  dispatchAuthChanged();
}

export async function deleteDependentChild(dependentId) {
  ensureSupabaseConfigured();

  const current = getCurrentUser();
  if (!current) {
    throw new Error('Faca login para excluir dependentes.');
  }
  if (!current.familyId) {
    throw new Error('Voce precisa estar em uma familia.');
  }

  const safeDependentId = String(dependentId || '').trim();
  if (!safeDependentId) throw new Error('Dependente invalido.');

  // Legacy local dependents used ids like "dep-...". Remove them from local cache only.
  if (!isUuid(safeDependentId)) {
    const db = readDb();
    db.families = db.families.map((family) => {
      if (family.id !== current.familyId) return family;
      const dependents = Array.isArray(family.dependents) ? family.dependents : [];
      return {
        ...family,
        dependents: dependents.filter((d) => String(d.id) !== safeDependentId),
      };
    });
    writeDb(db);
    dispatchAuthChanged();
    return;
  }

  const { error } = await supabase
    .from('dependents')
    .delete()
    .eq('id', safeDependentId)
    .eq('family_id', current.familyId);

  if (error) throw new Error(error.message || 'Nao foi possivel excluir o filho.');

  await syncUserFromRemote(current.id);
  dispatchAuthChanged();
}

export function getDataScopeKey() {
  const user = getCurrentUser();
  if (!user) return 'guest';
  if (user.familyId) return `family:${user.familyId}`;
  return `user:${user.id}`;
}
