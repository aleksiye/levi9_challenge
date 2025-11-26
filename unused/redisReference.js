// ============================================
// BASIC STRING OPERATIONS
// ============================================

// SET a key-value pair
app.post('/set', async (req, res) => {
  try {
    const { key, value } = req.body;
    await redisClient.set(key, value);
    res.json({ message: `Set ${key} = ${value}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET a value by key
app.get('/get/:key', async (req, res) => {
  try {
    const value = await redisClient.get(req.params.key);
    res.json({ key: req.params.key, value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SET with expiration (TTL in seconds)
app.post('/setex', async (req, res) => {
  try {
    const { key, value, ttl } = req.body;
    await redisClient.setEx(key, ttl, value);
    res.json({ message: `Set ${key} = ${value} with TTL of ${ttl} seconds` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a key
app.delete('/del/:key', async (req, res) => {
  try {
    const result = await redisClient.del(req.params.key);
    res.json({ deleted: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// COUNTER OPERATIONS (INCR/DECR)
// ============================================

// INCREMENT a counter
app.post('/incr/:key', async (req, res) => {
  try {
    const value = await redisClient.incr(req.params.key);
    res.json({ key: req.params.key, value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DECREMENT a counter
app.post('/decr/:key', async (req, res) => {
  try {
    const value = await redisClient.decr(req.params.key);
    res.json({ key: req.params.key, value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// HASH OPERATIONS
// ============================================

// Set hash fields
app.post('/hash/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const fields = req.body; // { field1: value1, field2: value2, ... }
    await redisClient.hSet(key, fields);
    res.json({ message: `Hash ${key} updated`, fields });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Get all hash fields
app.get('/hash/:key', async (req, res) => {
  try {
    const data = await redisClient.hGetAll(req.params.key);
    res.json({ key: req.params.key, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single hash field
app.get('/hash/:key/:field', async (req, res) => {
  try {
    const value = await redisClient.hGet(req.params.key, req.params.field);
    res.json({ key: req.params.key, field: req.params.field, value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// LIST OPERATIONS
// ============================================

// Push to list (left)
app.post('/list/:key/lpush', async (req, res) => {
  try {
    const { value } = req.body;
    const length = await redisClient.lPush(req.params.key, value);
    res.json({ key: req.params.key, length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Push to list (right)
app.post('/list/:key/rpush', async (req, res) => {
  try {
    const { value } = req.body;
    const length = await redisClient.rPush(req.params.key, value);
    res.json({ key: req.params.key, length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get list range
app.get('/list/:key', async (req, res) => {
  try {
    const { start = 0, end = -1 } = req.query;
    const items = await redisClient.lRange(req.params.key, parseInt(start), parseInt(end));
    res.json({ key: req.params.key, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pop from list (left)
app.post('/list/:key/lpop', async (req, res) => {
  try {
    const value = await redisClient.lPop(req.params.key);
    res.json({ key: req.params.key, value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SET OPERATIONS
// ============================================

// Add to set
app.post('/set/:key/add', async (req, res) => {
  try {
    const { members } = req.body; // array of members
    const added = await redisClient.sAdd(req.params.key, members);
    res.json({ key: req.params.key, added });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all set members
app.get('/set/:key/members', async (req, res) => {
  try {
    const members = await redisClient.sMembers(req.params.key);
    res.json({ key: req.params.key, members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if member exists in set
app.get('/set/:key/ismember/:member', async (req, res) => {
  try {
    const isMember = await redisClient.sIsMember(req.params.key, req.params.member);
    res.json({ key: req.params.key, member: req.params.member, isMember });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// UTILITY OPERATIONS
// ============================================

// Check if key exists
app.get('/exists/:key', async (req, res) => {
  try {
    const exists = await redisClient.exists(req.params.key);
    res.json({ key: req.params.key, exists: exists === 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get TTL of a key
app.get('/ttl/:key', async (req, res) => {
  try {
    const ttl = await redisClient.ttl(req.params.key);
    res.json({ key: req.params.key, ttl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all keys matching pattern
app.get('/keys/:pattern', async (req, res) => {
  try {
    const keys = await redisClient.keys(req.params.pattern);
    res.json({ pattern: req.params.pattern, keys });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Flush all data (be careful!)
app.delete('/flushall', async (req, res) => {
  try {
    await redisClient.flushAll();
    res.json({ message: 'All data flushed!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



console.log('  STRING:  POST /set, GET /get/:key, POST /setex, DELETE /del/:key');
  console.log('  COUNTER: POST /incr/:key, POST /decr/:key');
  console.log('  HASH:    POST /hash/:key, GET /hash/:key, GET /hash/:key/:field');
  console.log('  LIST:    POST /list/:key/lpush, POST /list/:key/rpush, GET /list/:key, POST /list/:key/lpop');
  console.log('  SET:     POST /set/:key/add, GET /set/:key/members, GET /set/:key/ismember/:member');
  console.log('  UTILITY: GET /exists/:key, GET /ttl/:key, GET /keys/:pattern, DELETE /flushall');