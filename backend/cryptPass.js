const bcrypt = require('bcryptjs');

bcrypt.hash("jp123", 10).then(console.log);