// src/firebase.js
import admin from 'firebase-admin';
import fs from 'fs';
import { cfg } from './config.js';

if (!cfg.fbDbUrl) throw new Error('FB_DB_URL is required');

const saPath = new URL('./serviceAcc.json', import.meta.url); // resolves relative to this file
const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: cfg.fbDbUrl,
});

export const db = admin.database();
export const adminSDK = admin;
