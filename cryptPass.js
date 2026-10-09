const bcrypt = require('bcryptjs');

bcrypt.hash("bs001", 10).then(console.log);