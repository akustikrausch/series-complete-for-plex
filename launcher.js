const express = require('express'); 
const app = express(); 
app.use((req, res, next) => { 
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`); 
  next(); 
}); 
require('./server.js'); 
