import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

let db: any

export async function openDb() {
  if (!db) {
    db = await open({
      filename: './worktime.sqlite',
      driver: sqlite3.Database
    })
    await db.exec(`
      CREATE TABLE IF NOT EXISTS work_times (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT,
        hours REAL,
        date TEXT
      );
      CREATE TABLE IF NOT EXISTS credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
      )
    `)
  }
  return db
}

export async function addWorkTime(description: string, hours: number, date: string) {
  const db = await openDb()
  return db.run('INSERT INTO work_times (description, hours, date) VALUES (?, ?, ?)', [description, hours, date])
}

export async function getWorkTimes() {
  const db = await openDb()
  return db.all('SELECT * FROM work_times ORDER BY date DESC')
}

export async function addCredential(username: string, password: string) {
  const db = await openDb()
  return db.run('INSERT INTO credentials (username, password) VALUES (?, ?)', [username, password])
}

export async function getActiveCredential() {
  const db = await openDb()
  return db.get('SELECT * FROM credentials ORDER BY id DESC LIMIT 1')
}

export async function getCredential(username: string) {
  const db = await openDb()
  return db.get('SELECT * FROM credentials WHERE username = ?', [username])
}

export async function verifyCredential(username: string, password: string) {
  const credential = await getCredential(username)
  if (!credential) {
    return null
  }
  return password === credential.password
}
