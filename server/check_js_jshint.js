const JSHint = require('jshint').JSHINT;
const fs = require('fs');

const filePath = process.argv[2];
const code = fs.readFileSync(filePath, 'utf-8');

// JSHint configuration with stricter rules
const options = {
    esversion: 11,      // Support ES2021
    undef: true,        // Report undefined variables
    unused: true,       // Report unused variables
    browser: true,      // Browser environment
    strict: 'implied',  // Enforce strict mode
    eqeqeq: true,       // Require === and !==
    singleGroups: true, // Disallow single equals in conditions
    maxcomplexity: 10,  // Warn on overly complex functions
    maxdepth: 3,        // Warn on deeply nested blocks
    bitwise: true,      // Warn on bitwise operators
    freeze: true        // Prevent overwriting prototypes
};

const globals = {
    console: true,
    document: true,
    window: true
};

// Run JSHint
JSHint(code, options, globals);

const errors = JSHint.errors.map(error => ({
    line: error.line || 0,
    column: error.character || 0,
    type: error.code.startsWith('E') ? 'Error' : 'Warning',
    message: error.reason || 'Unknown error'
}));

// Output errors as JSON
console.log(JSON.stringify(errors));