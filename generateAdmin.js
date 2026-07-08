const bcrypt = require("bcrypt");

async function generate() {
    const password = "P0cKetdE${";

    const hash = await bcrypt.hash(password, 10);

    console.log(hash);
}

generate();