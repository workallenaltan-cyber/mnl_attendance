const bcrypt = require('bcryptjs');

bcrypt.hash("ah002", 10).then(console.log);