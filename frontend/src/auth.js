function clearStoredAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function saveAuth(payload) {
  const token = payload?.token;
  const user = payload?.user;

  if (!token || !user || typeof user !== 'object') {
    throw new Error('Invalid authentication response');
  }

  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function logout() {
  clearStoredAuth();
}

export function currentUser() {
  const rawUser = localStorage.getItem('user');

  if (!rawUser) {
    return null;
  }

  try {
    const parsedUser = JSON.parse(rawUser);

    if (!parsedUser || typeof parsedUser !== 'object') {
      clearStoredAuth();
      return null;
    }

    return parsedUser;
  } catch (error) {
    console.error('Invalid stored auth payload:', error);
    clearStoredAuth();
    return null;
  }
}
