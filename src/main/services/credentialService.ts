import { addCredential, verifyCredential } from '../database/database';

export async function registerUser(username: string, password: string) {
  try {
    await addCredential(username, password);
    return { success: true, message: 'User registered successfully' };
  } catch (error) {
    console.error('Error registering user:', error);
    return { success: false, message: 'Error registering user' };
  }
}

export async function loginUser(username: string, password: string) {
  const user = await verifyCredential(username, password);
  if (user) {
    return { success: true, message: 'Login successful', user };
  } else {
    return { success: false, message: 'Invalid username or password' };
  }
}
