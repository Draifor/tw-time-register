import axios from 'axios';
import { getActiveCredential } from '../database/database';

let credentials = { username: '', password: '' };

// (async () => {credentials = await getActiveCredential()})()

const api = axios.create({
  baseURL: `https://grupocadena.teamwork.com/tasks`,
  headers: {
    Authorization: `Basic ${credentials.password}`,
    'Content-Type': 'application/json'
  }
});

export async function registerTimeEntry(
  taskId: string,
  description: string,
  hours: number,
  minutes: number,
  time: number,
  date: string,
  isBillable: boolean
) {
  try {
    const response = await api.post(`/${taskId}/time_entries.json`, {
      'time-entry': {
        description,
        date,
        time,
        hours,
        minutes,
        isBillable,
        'person-id': credentials.username,
        tags: 'API'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error registering time entry:', error);
    throw error;
  }
}
