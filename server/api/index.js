import express from 'express';

import { authMiddleware, instanceMiddleware } from '../helpers/middlewares.js';
const app = express();
import { config, generateGatewayURL } from '../helpers/globalutils.js';
import activities from './activities.ts';
import admin from './admin.js';
import auth from './auth.js';
import channels from './channels.js';
import connections from './connections.js';
import entitlements from './entitlements.js';
import gifs from './gifs.js';
import guilds from './guilds.js';
import integrations from './integrations.js';
import invites from './invites.js';
import oauth2 from './oauth2/index.js';
import reports from './reports.js';
import spacebarPing from "./spacebar-compat/ping.ts";
import spacebarPolicies from './spacebar-compat/policies.ts';
import store from './store.js';
import tutorial from './tutorial.js';
import users from './users/index.js';
import voice from './voice.ts';
import webhooks from './webhooks.js';

global.config = config;
//just in case

app.use('/auth', auth);
app.use('/connections', instanceMiddleware('VERIFIED_EMAIL_REQUIRED'), connections);

app.get('/incidents/unresolved.json', (req, res) => {
  return res.status(200).json({
    scheduled_maintenances: [],
    incidents: [],
  });
});

app.get('/scheduled-maintenances/upcoming.json', (req, res) => {
  return res.status(200).json({
    scheduled_maintenances: [],
  });
});

app.get('/scheduled-maintenances/active.json', (req, res) => {
  return res.status(200).json({
    scheduled_maintenances: [],
    incidents: [],
  });
});

app.use('/policies', spacebarPolicies);

app.use('/ping', spacebarPing);

app.get('/experiments', (req, res) => {
  return res.status(200).json({ assignments: [] });
});

app.get('/promotions', (req, res) => {
  return res.status(200).json([]);
});

app.get('/applications', (req, res) => {
  return res.status(200).json([]);
});

app.get('/activities', (req, res) => {
  return res.status(200).json([]);
});

app.get('/applications/detectable', (req, res) => {
  return res.status(200).json([]);
});

app.get('/games', (req, res) => {
  return res.status(200).json([]);
});

app.get('/gateway', (req, res) => {
  return res.status(200).json({
    url: generateGatewayURL(req),
  });
});

app.get('/gateway/bot', (req, res) => {
  return res.status(200).json({
    url: generateGatewayURL(req),
    shards: 0,
    session_start_limit: {
      total: 1,
      remaining: 1,
      reset_after: 14400000,
      max_concurrency: 1,
    },
  });
});

app.get('/voice/ice', (req, res) => {
  return res.status(200).json({
    servers: [
      {
        url: 'stun:stun.l.google.com:19302',
        username: '',
        credential: '',
      },
    ],
  });
});

app.use('/reports', reports);

app.use(authMiddleware);

app.use('/admin', instanceMiddleware('VERIFIED_EMAIL_REQUIRED'), admin);
app.use('/tutorial', instanceMiddleware('VERIFIED_EMAIL_REQUIRED'), tutorial);
app.use('/users', instanceMiddleware('VERIFIED_EMAIL_REQUIRED'), users);
app.use('/voice', instanceMiddleware('VERIFIED_EMAIL_REQUIRED'), voice);
app.use('/guilds', instanceMiddleware('VERIFIED_EMAIL_REQUIRED'), guilds);
app.use('/channels', channels);
app.use('/gifs', gifs);
app.use('/entitlements', instanceMiddleware('VERIFIED_EMAIL_REQUIRED'), entitlements);
app.use('/activities', instanceMiddleware('VERIFIED_EMAIL_REQUIRED'), activities);
app.use(['/invite', '/invites'], instanceMiddleware('VERIFIED_EMAIL_REQUIRED'), invites);
app.use('/webhooks', instanceMiddleware('VERIFIED_EMAIL_REQUIRED'), webhooks);
app.use('/oauth2', instanceMiddleware('VERIFIED_EMAIL_REQUIRED'), oauth2);
app.use('/store', instanceMiddleware('VERIFIED_EMAIL_REQUIRED'), store);
app.use('/integrations', instanceMiddleware('VERIFIED_EMAIL_REQUIRED'), integrations);

app.use('/track', (_, res) => {
  return res.status(204).send();
});

app.use('/science', (_, res) => {
  return res.status(204).send();
});

export default app;
