const AUTH_DB_KEY = 'fd-auth-db';
const AUTH_SESSION_KEY = 'fd-auth-session';

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function generateFamilyCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
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

export function addDependentChild({ name, birthDate = '', photoUrl = '' }) {
  const current = getCurrentUser();
  if (!current) {
    throw new Error('Faça login para adicionar dependentes.');
  }
  if (!current.familyId) {
    throw new Error('Crie ou entre em uma família primeiro.');
  }

  const safeName = String(name || '').trim();
  if (!safeName) {
    throw new Error('Informe o nome da criança.');
  }

  const safeBirthDate = String(birthDate || '').trim();
  const safePhotoUrl = String(photoUrl || '').trim();

  const db = readDb();
  const family = db.families.find((f) => f.id === current.familyId);
  if (!family) {
    throw new Error('Família não encontrada.');
  }

  if (!Array.isArray(family.dependents)) {
    family.dependents = [];
  }

  const alreadyExists = family.dependents.some((d) => String(d.name || '').trim().toLowerCase() === safeName.toLowerCase());
  if (alreadyExists) {
    throw new Error('Já existe um dependente com esse nome na família.');
  }

  const dependent = {
    id: generateId('dep'),
    name: safeName,
    role: 'filho',
    birthDate: safeBirthDate || null,
    photoUrl: safePhotoUrl || null,
    createdBy: current.id,
    createdAt: new Date().toISOString(),
  };

  family.dependents.push(dependent);
  writeDb(db);
  dispatchAuthChanged();
  return dependent;
}

export function updateDependentChild({ dependentId, name, birthDate = '', photoUrl = '' }) {
  const current = getCurrentUser();
  if (!current) {
    throw new Error('Faça login para editar dependentes.');
  }
  if (!current.familyId) {
    throw new Error('Você precisa estar em uma família.');
  }

  const safeDependentId = String(dependentId || '').trim();
  const safeName = String(name || '').trim();
  const safeBirthDate = String(birthDate || '').trim();
  const safePhotoUrl = String(photoUrl || '').trim();

  if (!safeDependentId) throw new Error('Dependente inválido.');
  if (!safeName) throw new Error('Informe o nome da criança.');

  const db = readDb();
  const family = db.families.find((f) => f.id === current.familyId);
  if (!family) throw new Error('Família não encontrada.');

  if (!Array.isArray(family.dependents)) {
    family.dependents = [];
  }

  const dependent = family.dependents.find((d) => d.id === safeDependentId);
  if (!dependent) {
    throw new Error('Dependente não encontrado.');
  }

  const alreadyExists = family.dependents.some(
    (d) => d.id !== safeDependentId && String(d.name || '').trim().toLowerCase() === safeName.toLowerCase()
  );
  if (alreadyExists) {
    throw new Error('Já existe outro dependente com esse nome na família.');
  }

  dependent.name = safeName;
  dependent.birthDate = safeBirthDate || null;
  dependent.photoUrl = safePhotoUrl || null;
  dependent.updatedAt = new Date().toISOString();

  writeDb(db);
  dispatchAuthChanged();
  return dependent;
}

export function registerUser({ name, email, password }) {
  const safeName = String(name || '').trim();
  const safeEmail = normalizeEmail(email);
  const safePassword = String(password || '').trim();

  if (!safeName || !safeEmail || !safePassword) {
    throw new Error('Preencha nome, email e senha.');
  }

  const db = readDb();
  const exists = db.users.some((u) => normalizeEmail(u.email) === safeEmail);
  if (exists) {
    throw new Error('Este email já está cadastrado.');
  }

  const user = {
    id: generateId('usr'),
    name: safeName,
    email: safeEmail,
    password: safePassword,
    familyId: null,
    createdAt: new Date().toISOString(),
  };

  db.users.push(user);
  writeDb(db);

  writeSession({ userId: user.id, loggedAt: new Date().toISOString() });
  dispatchAuthChanged();
  return user;
}

export function loginUser(email, password) {
  const safeEmail = normalizeEmail(email);
  const safePassword = String(password || '').trim();
  const db = readDb();
  const user = db.users.find((u) => normalizeEmail(u.email) === safeEmail);

  if (!user || user.password !== safePassword) {
    throw new Error('Email ou senha inválidos.');
  }

  writeSession({ userId: user.id, loggedAt: new Date().toISOString() });
  dispatchAuthChanged();
  return user;
}

export function logoutUser() {
  writeSession(null);
  dispatchAuthChanged();
}

export function updateUserPassword(newPassword) {
  const current = getCurrentUser();
  if (!current) throw new Error('Faça login para alterar a senha.');

  const safePassword = String(newPassword || '').trim();
  if (safePassword.length < 4) {
    throw new Error('A senha deve ter pelo menos 4 caracteres.');
  }

  const db = readDb();
  const user = db.users.find((u) => u.id === current.id);
  if (!user) throw new Error('Usuário não encontrado.');

  user.password = safePassword;
  writeDb(db);
  dispatchAuthChanged();
}

export function updateUserProfile({ name, photoUrl }) {
  const current = getCurrentUser();
  if (!current) throw new Error('Faça login para alterar o perfil.');

  const db = readDb();
  const user = db.users.find((u) => u.id === current.id);
  if (!user) throw new Error('Usuário não encontrado.');

  if (name !== undefined) user.name = String(name || '').trim();
  if (photoUrl !== undefined) user.photoUrl = photoUrl;

  writeDb(db);
  dispatchAuthChanged();
}

export function createFamily(name) {
  const current = getCurrentUser();
  if (!current) {
    throw new Error('Faça login para criar uma família.');
  }

  const safeName = String(name || '').trim();
  if (!safeName) {
    throw new Error('Informe o nome da família.');
  }

  const db = readDb();
  const user = db.users.find((u) => u.id === current.id);
  if (!user) throw new Error('Usuário não encontrado.');

  if (user.familyId) {
    const already = db.families.find((f) => f.id === user.familyId);
    if (already) return already;
  }

  const family = {
    id: generateId('fam'),
    name: safeName,
    code: generateFamilyCode(),
    ownerId: user.id,
    createdAt: new Date().toISOString(),
  };

  user.familyId = family.id;
  db.families.push(family);
  writeDb(db);
  dispatchAuthChanged();
  return family;
}

export function joinFamilyByCode(code) {
  const current = getCurrentUser();
  if (!current) {
    throw new Error('Faça login para entrar em uma família.');
  }

  const safeCode = String(code || '').trim().toUpperCase();
  if (!safeCode) throw new Error('Informe o código da família.');

  const db = readDb();
  const family = db.families.find((f) => String(f.code || '').toUpperCase() === safeCode);
  if (!family) {
    throw new Error('Código de família não encontrado.');
  }

  const user = db.users.find((u) => u.id === current.id);
  if (!user) throw new Error('Usuário não encontrado.');

  user.familyId = family.id;
  writeDb(db);
  dispatchAuthChanged();
  return family;
}

export function getDataScopeKey() {
  const user = getCurrentUser();
  if (!user) return 'guest';
  if (user.familyId) return `family:${user.familyId}`;
  return `user:${user.id}`;
}
