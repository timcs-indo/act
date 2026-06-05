#!/usr/bin/env node

const http = require('http');

// Get auth token (we need to login first)
// For simplicity, let's just make a request to the API with hardcoded params

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/reports/dashboard?startDate=2026-05-31&endDate=2026-06-05',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' // We'll need to get the token somehow
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response status:', res.statusCode);
    console.log('Response data:', data);
    try {
      const json = JSON.parse(data);
      console.log('Handover count:', json.handoverCount);
    } catch (e) {
      console.log('Could not parse JSON');
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
